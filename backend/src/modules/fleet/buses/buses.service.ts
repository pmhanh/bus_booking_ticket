import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Bus, BusType } from './bus.entity';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { Trip, TripStatus } from '../../inventory/trips/trip.entity';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';

@Injectable()
export class BusesService {
  constructor(
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(SeatMap)
    private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    private readonly images: CloudinaryService,
  ) {}

  list() {
    return this.busRepo.find();
  }

  async findById(id: number) {
    const bus = await this.busRepo.findOne({ where: { id } });
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
  }

  private async resolveSeatMap(seatMapId: number) {
    const map = await this.seatMapRepo.findOne({ where: { id: seatMapId } });
    if (!map) throw new BadRequestException('Seat map not found');
    return map;
  }

  private async assertNoUnfinishedTripsForSeatMapChange(busId: number) {
    const unfinishedTrip = await this.tripRepo.findOne({
      where: {
        bus: { id: busId },
        status: In([TripStatus.SCHEDULED, TripStatus.IN_PROGRESS]),
      },
    });

    if (unfinishedTrip) {
      throw new BadRequestException(
        'Cannot change seat map while the bus has unfinished trips',
      );
    }
  }

  private async assertPlateAvailable(
    plateNumber: string,
    currentBusId?: number,
  ) {
    const existing = await this.busRepo.findOne({ where: { plateNumber } });
    if (existing && existing.id !== currentBusId) {
      throw new ConflictException(
        `Biển số ${plateNumber} đã được sử dụng bởi xe khác.`,
      );
    }
  }

  private async saveBus(bus: Bus) {
    try {
      return await this.busRepo.save(bus);
    } catch (error) {
      // Keep the database constraint as the final guard against simultaneous requests.
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as {
          code?: string;
          constraint?: string;
        };
        const isPlateConflict =
          driverError.code === '23505' &&
          this.busRepo.metadata.uniques.some(
            (unique) =>
              unique.name === driverError.constraint &&
              unique.columns.length === 1 &&
              unique.columns[0].propertyName === 'plateNumber',
          );
        if (isPlateConflict) {
          throw new ConflictException(
            `Biển số ${bus.plateNumber} đã được sử dụng bởi xe khác.`,
          );
        }
      }
      throw error;
    }
  }

  async create(dto: CreateBusDto) {
    const plateNumber = dto.plateNumber.trim().toUpperCase();
    await this.assertPlateAvailable(plateNumber);
    const seatMap = await this.resolveSeatMap(dto.seatMapId);
    const bus = this.busRepo.create({
      name: dto.name,
      plateNumber,
      busType: dto.busType ?? BusType.SEATER,
      amenities: dto.amenities || [],
      seatMap,
    });
    return this.saveBus(bus);
  }

  async update(id: number, dto: UpdateBusDto) {
    const bus = await this.findById(id);

    if (dto.plateNumber !== undefined) {
      const plateNumber = dto.plateNumber.trim().toUpperCase();
      await this.assertPlateAvailable(plateNumber, id);
      bus.plateNumber = plateNumber;
    }

    if (dto.seatMapId !== undefined) {
      const seatMap = await this.resolveSeatMap(dto.seatMapId);
      if (seatMap.id !== bus.seatMap.id) {
        await this.assertNoUnfinishedTripsForSeatMapChange(id);
        bus.seatMap = seatMap;
      }
    }

    if (dto.name) bus.name = dto.name;
    if (dto.busType) bus.busType = dto.busType;
    if (dto.amenities !== undefined) bus.amenities = dto.amenities;
    return this.saveBus(bus);
  }

  async delete(id: number) {
    const publicIds = await this.busRepo.manager.transaction(
      async (manager) => {
        const bus = await manager.findOne(Bus, {
          where: { id },
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        });
        if (!bus) throw new NotFoundException('Bus not found');
        await manager.delete(Bus, id);
        return Object.values(bus.photoPublicIds || {});
      },
    );
    await Promise.all(
      publicIds.map((publicId) => this.images.cleanupImage(publicId)),
    );
    return { ok: true };
  }

  async addPhoto(id: number, file?: Express.Multer.File) {
    await this.findById(id);
    const image = await this.images.uploadImage(file, 'buses');
    try {
      await this.busRepo.manager.transaction(async (manager) => {
        const bus = await manager.findOne(Bus, {
          where: { id },
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        });
        if (!bus) throw new NotFoundException('Bus not found');
        bus.photos = [...(bus.photos || []), image.url];
        bus.photoPublicIds = {
          ...bus.photoPublicIds,
          [image.url]: image.publicId,
        };
        await manager.save(Bus, bus);
      });
    } catch (error) {
      await this.images.cleanupImage(image.publicId);
      throw error;
    }
    return this.findById(id);
  }

  async deletePhoto(id: number, photoUrl: string) {
    if (typeof photoUrl !== 'string' || !photoUrl) {
      throw new BadRequestException('Photo URL is required');
    }
    await this.busRepo.manager.transaction(async (manager) => {
      const bus = await manager.findOne(Bus, {
        where: { id },
        loadEagerRelations: false,
        lock: { mode: 'pessimistic_write' },
      });
      if (!bus) throw new NotFoundException('Bus not found');
      if (!bus.photos?.includes(photoUrl)) {
        throw new NotFoundException('Photo not found');
      }
      const publicId = bus.photoPublicIds?.[photoUrl];
      // Delete only the stored asset belonging to this bus, never a client-supplied ID.
      if (publicId) await this.images.deleteImage(publicId);
      bus.photos = bus.photos.filter((url) => url !== photoUrl);
      if (bus.photoPublicIds) delete bus.photoPublicIds[photoUrl];
      await manager.save(Bus, bus);
    });
    return this.findById(id);
  }

  async updateStatus(id: number, isActive: boolean) {
    const bus = await this.findById(id);
    bus.isActive = isActive;
    await this.busRepo.save(bus);
    return bus;
  }
}
