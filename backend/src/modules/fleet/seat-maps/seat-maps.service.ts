import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { SeatMap } from './seat-map.entity';
import { SeatDefinition } from './seat-definition.entity';
import { CreateSeatMapDto } from './dto/create-seat-map.dto';
import { UpdateSeatMapDto } from './dto/update-seat-map.dto';
import { SeatDto } from './dto/seat.dto';
import { TripSeat } from '../../inventory/trip-seats/trip-seat.entity';
import { Bus } from '../buses/bus.entity';

@Injectable()
export class SeatMapsService {
  constructor(
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(SeatDefinition)
    private readonly seatRepo: Repository<SeatDefinition>,
  ) {}

  private normalizeName(name: unknown): string {
    if (typeof name !== 'string' || !name.trim()) {
      throw new BadRequestException('Vui lòng nhập tên sơ đồ ghế.');
    }
    return name.trim();
  }

  private validateSeats(rows: number, cols: number, seats: SeatDto[]) {
    const seenCodes = new Set<string>();
    const seenPositions = new Set<string>();
    for (const seat of seats) {
      if (seat.row < 1 || seat.row > rows)
        throw new BadRequestException('Seat row out of range');
      if (seat.col < 1 || seat.col > cols)
        throw new BadRequestException('Seat col out of range');
      if (seenCodes.has(seat.code))
        throw new BadRequestException('Duplicate seat code');
      seenCodes.add(seat.code);

      const position = `${seat.row}-${seat.col}`;
      if (seenPositions.has(position)) {
        throw new BadRequestException('Duplicate seat position');
      }
      seenPositions.add(position);
    }
  }

  private seatChanged(existing: SeatDefinition, next: SeatDto): boolean {
    return (
      existing.code !== next.code ||
      existing.row !== next.row ||
      existing.col !== next.col ||
      existing.isActive !== (next.isActive ?? existing.isActive)
    );
  }

  async create(dto: CreateSeatMapDto) {
    const name = this.normalizeName(dto.name);
    this.validateSeats(dto.rows, dto.cols, dto.seats);

    return this.seatMapRepo.manager.transaction(async (em) => {
      const mapRepo = em.getRepository(SeatMap);
      const seatRepo = em.getRepository(SeatDefinition);

      const saved = await mapRepo.save(
        mapRepo.create({
          name,
          rows: dto.rows,
          cols: dto.cols,
        }),
      );

      await seatRepo.save(
        dto.seats.map((s) =>
          seatRepo.create({
            seatMap: saved,
            code: s.code,
            row: s.row,
            col: s.col,
            isActive: s.isActive ?? true,
          }),
        ),
      );

      return mapRepo.findOne({
        where: { id: saved.id },
        relations: ['seats'],
        order: { seats: { row: 'ASC', col: 'ASC' } },
      });
    });
  }

  async list() {
    const [maps, usage] = await Promise.all([
      this.seatMapRepo.find({ relations: ['seats'] }),
      this.seatMapRepo.manager
        .getRepository(Bus)
        .createQueryBuilder('bus')
        .select('bus.seat_map_id', 'seatMapId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bus.seat_map_id')
        .getRawMany<{ seatMapId: number; count: string }>(),
    ]);
    const counts = new Map(
      usage.map((item) => [Number(item.seatMapId), Number(item.count)]),
    );
    return maps.map((map) => ({ ...map, busCount: counts.get(map.id) ?? 0 }));
  }

  async findById(id: number) {
    const map = await this.seatMapRepo.findOne({
      where: { id },
      relations: ['seats'],
      order: { seats: { row: 'ASC', col: 'ASC' } },
    });
    if (!map) throw new NotFoundException('Seat map not found');
    return map;
  }

  async update(id: number, dto: UpdateSeatMapDto) {
    const name =
      dto.name === undefined ? undefined : this.normalizeName(dto.name);
    return this.seatMapRepo.manager.transaction(async (manager) => {
      const mapRepo = manager.getRepository(SeatMap);
      const seatRepo = manager.getRepository(SeatDefinition);
      const map = await mapRepo.findOne({ where: { id } });
      if (!map) throw new NotFoundException('Seat map not found');

      const existingSeats = await seatRepo.find({
        where: { seatMap: { id } },
        order: { row: 'ASC', col: 'ASC' },
      });
      const rows = dto.rows ?? map.rows;
      const cols = dto.cols ?? map.cols;
      const submittedSeats = dto.seats ?? existingSeats;
      this.validateSeats(rows, cols, submittedSeats);

      if (name !== undefined) map.name = name;
      map.rows = rows;
      map.cols = cols;

      if (dto.seats !== undefined) {
        const existingById = new Map(
          existingSeats.map((seat) => [seat.id, seat]),
        );
        const submittedIds = dto.seats
          .map((seat) => seat.id)
          .filter((seatId): seatId is number => seatId !== undefined);

        if (new Set(submittedIds).size !== submittedIds.length) {
          throw new BadRequestException('Seat id must be unique');
        }
        for (const seatId of submittedIds) {
          if (!existingById.has(seatId)) {
            throw new BadRequestException(
              'Seat does not belong to this seat map',
            );
          }
        }

        const submittedById = new Map(
          dto.seats
            .filter(
              (seat): seat is SeatDto & { id: number } => seat.id !== undefined,
            )
            .map((seat) => [seat.id, seat]),
        );
        const changedOrRemovedIds = existingSeats
          .filter((existing) => {
            const submitted = submittedById.get(existing.id);
            return !submitted || this.seatChanged(existing, submitted);
          })
          .map((seat) => seat.id);

        if (changedOrRemovedIds.length > 0) {
          const tripSeatCount = await manager
            .getRepository(TripSeat)
            .createQueryBuilder('tripSeat')
            .where('tripSeat.seat_definition_id IN (:...ids)', {
              ids: changedOrRemovedIds,
            })
            .getCount();
          if (tripSeatCount > 0) {
            throw new ConflictException(
              'Không thể sửa hoặc xóa ghế đã được dùng bởi chuyến xe',
            );
          }
        }

        const removedIds = existingSeats
          .filter((seat) => !submittedById.has(seat.id))
          .map((seat) => seat.id);
        if (removedIds.length > 0) {
          await seatRepo.delete(removedIds);
        }

        const retainedIds = existingSeats
          .filter((seat) => submittedById.has(seat.id))
          .map((seat) => seat.id);
        if (retainedIds.length > 0) {
          await seatRepo
            .createQueryBuilder()
            .update(SeatDefinition)
            .set({
              code: () => `CONCAT('__tmp_', id, '_', code)`,
              row: () => '"row" + 1000000',
            })
            .where('id IN (:...ids)', { ids: retainedIds })
            .execute();
        }

        const seatsToSave = dto.seats.map((seat) => {
          if (seat.id !== undefined) {
            const existing = existingById.get(seat.id)!;
            existing.code = seat.code;
            existing.row = seat.row;
            existing.col = seat.col;
            existing.isActive = seat.isActive ?? existing.isActive;
            return existing;
          }

          return seatRepo.create({
            seatMap: map,
            code: seat.code,
            row: seat.row,
            col: seat.col,
            isActive: seat.isActive ?? true,
          });
        });

        await seatRepo.save(seatsToSave);
      }

      await mapRepo.save(map);
      return mapRepo.findOne({
        where: { id },
        relations: ['seats'],
        order: { seats: { row: 'ASC', col: 'ASC' } },
      });
    });
  }

  async delete(id: number) {
    try {
      return await this.seatMapRepo.manager.transaction(async (manager) => {
        const mapRepo = manager.getRepository(SeatMap);
        // Lock the map while checking usage; concurrent bus assignments must wait.
        const map = await mapRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!map) throw new NotFoundException('Không tìm thấy sơ đồ ghế.');
        const inUse = await manager
          .getRepository(Bus)
          .existsBy({ seatMap: { id } });
        if (inUse) {
          throw new ConflictException(
            'Không thể xóa sơ đồ ghế vì đang có xe sử dụng.',
          );
        }
        await mapRepo.delete(id);
        return { ok: true };
      });
    } catch (error) {
      // Trip seats may still reference this layout after a bus changes its map.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23503'
      ) {
        throw new ConflictException(
          'Không thể xóa sơ đồ ghế vì vẫn còn dữ liệu xe hoặc chuyến xe sử dụng.',
        );
      }
      throw error;
    }
  }
}
