import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from './trip.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { SearchTripsDto } from './dto/search-trips.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
  ) {}

  private parseDates(departureTime: string, arrivalTime: string) {
    const dep = new Date(departureTime);
    const arr = new Date(arrivalTime);
    if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime()))
      throw new BadRequestException('Invalid date');
    if (dep >= arr)
      throw new BadRequestException('Departure must be before arrival');
    return { dep, arr };
  }

  private async assertNoBusConflict(
    busId: number,
    departureTime: Date,
    arrivalTime: Date,
    ignoreTripId?: number,
  ) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .where('trip.bus = :busId', { busId })
      .andWhere('trip.departureTime < :arrival', { arrival: arrivalTime })
      .andWhere(':departure < trip.arrivalTime', { departure: departureTime });
    if (ignoreTripId)
      qb.andWhere('trip.id != :ignoreId', { ignoreId: ignoreTripId });
    const conflict = await qb.getOne();
    if (conflict)
      throw new BadRequestException(
        'Schedule conflict: bus is already assigned to another trip.',
      );
  }

  private parseTimeToMinutes(value?: string) {
    if (!value) return undefined;
    const parts = value.split(':');
    if (parts.length !== 2)
      throw new BadRequestException('Invalid time format. Use HH:mm');
    const [h, m] = parts.map((v) => Number.parseInt(v, 10));
    if (
      Number.isNaN(h) ||
      Number.isNaN(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      throw new BadRequestException('Invalid time format. Use HH:mm');
    }
    return h * 60 + m;
  }

  private getDateRange(dateStr?: string) {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException('Invalid date');
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private computeDurationMinutes(trip: Trip) {
    return Math.round(
      (trip.arrivalTime.getTime() - trip.departureTime.getTime()) / 60000,
    );
  }

  async create(dto: CreateTripDto) {
    const route = await this.routeRepo.findOne({ where: { id: dto.routeId } });
    if (!route) throw new NotFoundException('Route not found');
    const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
    if (!bus) throw new NotFoundException('Bus not found');
    const { dep, arr } = this.parseDates(dto.departureTime, dto.arrivalTime);
    await this.assertNoBusConflict(bus.id, dep, arr);
    const trip = this.tripRepo.create({
      route,
      bus,
      departureTime: dep,
      arrivalTime: arr,
      basePrice: dto.basePrice,
      status: dto.status ?? 'SCHEDULED',
    });
    return this.tripRepo.save(trip);
  }

  list(filter?: {
    routeId?: number;
    busId?: number;
    fromDate?: string;
    toDate?: string;
    offset?: number;
    limit?: number;
  }) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('trip.bus', 'bus')
      .orderBy('trip.departureTime', 'DESC');
    if (filter?.routeId)
      qb.andWhere('route.id = :rid', { rid: filter.routeId });
    if (filter?.busId) qb.andWhere('bus.id = :bid', { bid: filter.busId });
    if (filter?.fromDate && filter?.toDate) {
      qb.andWhere('trip.departureTime BETWEEN :from AND :to', {
        from: new Date(filter.fromDate),
        to: new Date(filter.toDate),
      });
    } else if (filter?.fromDate) {
      qb.andWhere('trip.departureTime >= :from', {
        from: new Date(filter.fromDate),
      });
    } else if (filter?.toDate) {
      qb.andWhere('trip.departureTime <= :to', { to: new Date(filter.toDate) });
    }
    if (filter?.limit) qb.take(filter.limit);
    if (filter?.offset) qb.skip(filter.offset);
    return qb.getMany();
  }

  async searchPublic(params: SearchTripsDto) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('trip.bus', 'bus')
      .leftJoinAndSelect('bus.seatMap', 'seatMap')
      .where('trip.status = :status', { status: 'SCHEDULED' });

    const dateRange = this.getDateRange(params.date);
    if (params.originId)
      qb.andWhere('originCity.id = :originId', { originId: params.originId });
    if (params.destinationId)
      qb.andWhere('destinationCity.id = :destinationId', {
        destinationId: params.destinationId,
      });
    if (dateRange)
      qb.andWhere('trip.departureTime BETWEEN :start AND :end', dateRange);

    const startMinutes = this.parseTimeToMinutes(params.startTime);
    const endMinutes = this.parseTimeToMinutes(params.endTime);
    if (startMinutes !== undefined) {
      qb.andWhere(
        'EXTRACT(HOUR FROM trip.departureTime) * 60 + EXTRACT(MINUTE FROM trip.departureTime) >= :startMinutes',
        { startMinutes },
      );
    }
    if (endMinutes !== undefined) {
      qb.andWhere(
        'EXTRACT(HOUR FROM trip.departureTime) * 60 + EXTRACT(MINUTE FROM trip.departureTime) <= :endMinutes',
        { endMinutes },
      );
    }
    if (params.minPrice !== undefined)
      qb.andWhere('trip.basePrice >= :minPrice', { minPrice: params.minPrice });
    if (params.maxPrice !== undefined)
      qb.andWhere('trip.basePrice <= :maxPrice', { maxPrice: params.maxPrice });
    if (params.busType)
      qb.andWhere('LOWER(bus.busType) = LOWER(:busType)', {
        busType: params.busType,
      });
    if (params.amenities?.length)
      qb.andWhere('bus.amenities @> :amenities', {
        amenities: params.amenities,
      });

    const sortBy = params.sortBy || 'time';
    const sortOrder =
      params.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    if (sortBy === 'price') {
      qb.orderBy('trip.basePrice', sortOrder);
    } else if (sortBy === 'duration') {
      qb.addSelect(
        'EXTRACT(EPOCH FROM (trip.arrivalTime - trip.departureTime))',
        'duration_seconds',
      );
      qb.orderBy('duration_seconds', sortOrder);
      qb.addOrderBy('trip.departureTime', 'ASC');
    } else {
      qb.orderBy('trip.departureTime', sortOrder);
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    qb.take(limit).skip((page - 1) * limit);

    const [trips, total] = await qb.getManyAndCount();
    return {
      data: trips.map((trip) => ({
        ...trip,
        durationMinutes: this.computeDurationMinutes(trip),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: number) {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: ['route', 'route.originCity', 'route.destinationCity', 'bus'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async findPublicById(id: number) {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: [
        'route',
        'route.originCity',
        'route.destinationCity',
        'route.stops',
        'route.stops.city',
        'bus',
        'bus.seatMap',
        'bus.seatMap.seats',
      ],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return {
      ...trip,
      durationMinutes: this.computeDurationMinutes(trip),
    };
  }

  async update(id: number, dto: UpdateTripDto) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (dto.routeId) {
      const route = await this.routeRepo.findOne({
        where: { id: dto.routeId },
      });
      if (!route) throw new NotFoundException('Route not found');
      trip.route = route;
    }
    if (dto.busId) {
      const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
      if (!bus) throw new NotFoundException('Bus not found');
      trip.bus = bus;
    }
    const dep = dto.departureTime
      ? new Date(dto.departureTime)
      : trip.departureTime;
    const arr = dto.arrivalTime ? new Date(dto.arrivalTime) : trip.arrivalTime;
    if (dto.departureTime || dto.arrivalTime) {
      this.parseDates(dep.toISOString(), arr.toISOString());
    }
    await this.assertNoBusConflict(trip.bus.id, dep, arr, trip.id);
    trip.departureTime = dep;
    trip.arrivalTime = arr;
    if (dto.basePrice !== undefined) trip.basePrice = dto.basePrice;
    if (dto.status) trip.status = dto.status;
    return this.tripRepo.save(trip);
  }

  async delete(id: number) {
    const res = await this.tripRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Trip not found');
    return { ok: true };
  }
}
