import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatMap } from './seat-map.entity';
import { SeatDefinition } from './seat-definition.entity';
import { CreateSeatMapDto } from './dto/create-seat-map.dto';
import { UpdateSeatMapDto } from './dto/update-seat-map.dto';
import { SeatDto } from './dto/seat.dto';

@Injectable()
export class SeatMapsService {
  constructor(
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(SeatDefinition)
    private readonly seatRepo: Repository<SeatDefinition>,
  ) {}

  private validateSeats(rows: number, cols: number, seats: SeatDto[]) {
    const seenCodes = new Set<string>();
    for (const seat of seats) {
      if (seat.row < 1 || seat.row > rows)
        throw new BadRequestException('Seat row out of range');
      if (seat.col < 1 || seat.col > cols)
        throw new BadRequestException('Seat col out of range');
      if (seenCodes.has(seat.code))
        throw new BadRequestException('Duplicate seat code');
      seenCodes.add(seat.code);
    }
  }

  async create(dto: CreateSeatMapDto) {
    this.validateSeats(dto.rows, dto.cols, dto.seats);
    const map = this.seatMapRepo.create({
      name: dto.name,
      rows: dto.rows,
      cols: dto.cols,
    });
    const saved = await this.seatMapRepo.save(map);
    const seatEntities = dto.seats.map((s) =>
      this.seatRepo.create({
        seatMap: saved,
        code: s.code,
        row: s.row,
        col: s.col,
        price: s.price,
        seatType: s.seatType ?? 'standard',
        isActive: s.isActive ?? true,
      }),
    );
    await this.seatRepo.save(seatEntities);
    return this.findById(saved.id);
  }

  list() {
    return this.seatMapRepo.find();
  }

  async findById(id: number) {
    const map = await this.seatMapRepo.findOne({
      where: { id },
      relations: ['seats'],
      order: { seats: { row: 'ASC' } },
    });
    if (!map) throw new NotFoundException('Seat map not found');
    return map;
  }

  async update(id: number, dto: UpdateSeatMapDto) {
    const map = await this.seatMapRepo.findOne({ where: { id } });
    if (!map) throw new NotFoundException('Seat map not found');
    const rows = dto.rows ?? map.rows;
    const cols = dto.cols ?? map.cols;
    if (dto.seats) this.validateSeats(rows, cols, dto.seats);
    if (dto.name) map.name = dto.name;
    map.rows = rows;
    map.cols = cols;
    await this.seatMapRepo.save(map);
    if (dto.seats) {
      await this.seatRepo.delete({ seatMap: { id } });
      const seatEntities = dto.seats.map((s) =>
        this.seatRepo.create({
          seatMap: map,
          code: s.code,
          row: s.row,
          col: s.col,
          price: s.price,
          seatType: s.seatType ?? 'standard',
          isActive: s.isActive ?? true,
        }),
      );
      await this.seatRepo.save(seatEntities);
    }
    return this.findById(id);
  }

  async delete(id: number) {
    const res = await this.seatMapRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Seat map not found');
    return { ok: true };
  }
}
