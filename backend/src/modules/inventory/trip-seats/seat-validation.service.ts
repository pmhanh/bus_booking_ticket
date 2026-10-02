import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, In } from 'typeorm';
import { Trip, TripStatus } from '../trips/trip.entity';
import { TripSeat } from './trip-seat.entity';

@Injectable()
export class SeatValidationService {
  private readonly maxSeatsPerBooking: number;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.maxSeatsPerBooking = Number(
      configService.get('MAX_SEATS_PER_BOOKING') ?? 6,
    );
  }

  async validateSeatsForBooking(
    tripId: number,
    seatCodes: string[],
    manager: EntityManager = this.dataSource.manager,
    bookingId?: string,
  ) {
    const normalized = [
      ...new Set(seatCodes.map((code) => code.trim()).filter(Boolean)),
    ];

    if (!normalized.length) {
      throw new BadRequestException('At least one seat is required');
    }
    if (normalized.length > this.maxSeatsPerBooking) {
      throw new BadRequestException(
        `Seat limit exceeded (max ${this.maxSeatsPerBooking})`,
      );
    }

    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      relations: ['route', 'bus'],
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const canBook =
      [TripStatus.SCHEDULED, TripStatus.DELAYED].includes(trip.status) &&
      trip.departureTime > new Date() &&
      trip.route.isActive &&
      trip.bus.isActive;
    if (!canBook) {
      throw new BadRequestException('Trip is no longer available for booking');
    }

    const tripSeats = await manager.find(TripSeat, {
      where: {
        trip: { id: tripId },
        seatCodeSnapshot: In(normalized),
      },
      relations: ['seat'],
    });

    const seatsByCode = new Map(
      tripSeats.map((tripSeat) => [tripSeat.seatCodeSnapshot, tripSeat]),
    );
    const missing = normalized.filter((code) => !seatsByCode.has(code));
    if (missing.length) {
      throw new BadRequestException(
        `Seats not found in trip: ${missing.join(', ')}`,
      );
    }

    const inactive = normalized.filter(
      (code) => seatsByCode.get(code)!.seat.isActive === false,
    );
    if (inactive.length) {
      throw new BadRequestException(
        `Inactive seats cannot be held: ${inactive.join(', ')}`,
      );
    }

    const booked = normalized.filter((code) => {
      const seat = seatsByCode.get(code)!;
      return (
        seat.isBooked ||
        (seat.checkoutBookingId && seat.checkoutBookingId !== bookingId)
      );
    });
    if (booked.length) {
      throw new BadRequestException(
        `Seats already booked: ${booked.join(', ')}`,
      );
    }

    return {
      trip,
      tripSeats: normalized.map((code) => seatsByCode.get(code)!),
    };
  }
}
