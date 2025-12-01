import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, Repository } from 'typeorm';
import { Trip } from './trip.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';

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
    if (dep >= arr) throw new BadRequestException('Departure must be before arrival');
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
    if (ignoreTripId) qb.andWhere('trip.id != :ignoreId', { ignoreId: ignoreTripId });
    const conflict = await qb.getOne();
    if (conflict)
      throw new BadRequestException('Lịch của xe bị trùng. Chọn giờ hoặc xe khác.');
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

  list(filter?: { routeId?: number; busId?: number; fromDate?: string; toDate?: string; offset?: number; limit?: number }) {
    const qb = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('trip.bus', 'bus')
      .orderBy('trip.departureTime', 'DESC');
    if (filter?.routeId) qb.andWhere('route.id = :rid', { rid: filter.routeId });
    if (filter?.busId) qb.andWhere('bus.id = :bid', { bid: filter.busId });
    if (filter?.fromDate && filter?.toDate) {
      qb.andWhere('trip.departureTime BETWEEN :from AND :to', {
        from: new Date(filter.fromDate),
        to: new Date(filter.toDate),
      });
    } else if (filter?.fromDate) {
      qb.andWhere('trip.departureTime >= :from', { from: new Date(filter.fromDate) });
    } else if (filter?.toDate) {
      qb.andWhere('trip.departureTime <= :to', { to: new Date(filter.toDate) });
    }
    if (filter?.limit) qb.take(filter.limit);
    if (filter?.offset) qb.skip(filter.offset);
    return qb.getMany();
  }

  async findById(id: number) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async update(id: number, dto: UpdateTripDto) {
    const trip = await this.tripRepo.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');
    if (dto.routeId) {
      const route = await this.routeRepo.findOne({ where: { id: dto.routeId } });
      if (!route) throw new NotFoundException('Route not found');
      trip.route = route;
    }
    if (dto.busId) {
      const bus = await this.busRepo.findOne({ where: { id: dto.busId } });
      if (!bus) throw new NotFoundException('Bus not found');
      trip.bus = bus;
    }
    const dep = dto.departureTime ? new Date(dto.departureTime) : trip.departureTime;
    const arr = dto.arrivalTime ? new Date(dto.arrivalTime) : trip.arrivalTime;
    if (dto.departureTime || dto.arrivalTime) {
      this.parseDates(dep.toISOString(), arr.toISOString());
    }
    await this.assertNoBusConflict(trip.bus.id, dep, arr, trip.id);
    trip.departureTime = dep;
    trip.arrivalTime = arr;
    if (dto.basePrice) trip.basePrice = dto.basePrice;
    if (dto.status) trip.status = dto.status;
    return this.tripRepo.save(trip);
  }

  async delete(id: number) {
    const res = await this.tripRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Trip not found');
    return { ok: true };
  }
}
