import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { Trip } from './trip.entity';
import { TripSeat } from './trip-seat.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';

@Injectable()
export class SeatValidationService {
  private readonly maxSeatsPerBooking: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.maxSeatsPerBooking = Number(
      this.configService.get('MAX_SEATS_PER_BOOKING') ?? 6,
    );
  }

  private async validateWithManager(
    manager: EntityManager,
    tripId: number,
    seatCodes: string[],
  ) {
    const normalized = Array.from(new Set(seatCodes.map((s) => s.trim())));
    if (!normalized.length)
      throw new BadRequestException('At least one seat is required');
    if (normalized.length > this.maxSeatsPerBooking) {
      throw new BadRequestException(
        `Seat limit exceeded (max ${this.maxSeatsPerBooking})`,
      );
    }

    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      relations: ['bus', 'bus.seatMap', 'bus.seatMap.seats', 'route'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.bus?.seatMap?.id)
      throw new BadRequestException('Trip has no seat map assigned');

    // TripSeat phải được tạo sẵn khi tạo Trip (xem phần TripsService bên dưới)
    const tripSeats = await manager.find(TripSeat, {
      where: {
        trip: { id: tripId },
      },
      relations: ['seat'],
    });

    // map code -> TripSeat
    const codeToTripSeat = new Map<string, TripSeat>();
    for (const ts of tripSeats) {
      codeToTripSeat.set(ts.seatCodeSnapshot, ts);
    }

    const missing = normalized.filter((c) => !codeToTripSeat.has(c));
    if (missing.length) {
      throw new BadRequestException(`Seats not found in trip: ${missing.join(', ')}`);
    }

    const inactive = normalized.filter((c) => {
      const ts = codeToTripSeat.get(c)!;
      return ts.seat?.isActive === false;
    });
    if (inactive.length) {
      throw new BadRequestException(
        `Inactive seats cannot be booked: ${inactive.join(', ')}`,
      );
    }

    const booked = normalized.filter((c) => codeToTripSeat.get(c)!.isBooked);
    if (booked.length) {
      throw new BadRequestException(`Seat ${booked[0]} already booked`);
    }

    const pickedTripSeats = normalized.map((c) => codeToTripSeat.get(c)!);

    // seatMap để client render layout (optional return)
    const seatMap = await manager.findOne(SeatMap, {
      where: { id: trip.bus.seatMap.id },
      relations: ['seats'],
    });

    return { trip, seatMap, tripSeats: pickedTripSeats };
  }

  async validateSeatsForBooking(
    tripId: number,
    seatCodes: string[],
    manager?: EntityManager,
  ) {
    if (manager) return this.validateWithManager(manager, tripId, seatCodes);
    return this.dataSource.transaction((trx) =>
      this.validateWithManager(trx, tripId, seatCodes),
    );
  }
}







