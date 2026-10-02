import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatLockService } from '../../../infrastructure/redis/seat-lock.service';
import { Trip } from '../trips/trip.entity';
import { TripSeat } from './trip-seat.entity';
import { getRealTripStatus } from '../trips/trip-status.util';

type SeatStatus = 'available' | 'inactive' | 'held' | 'booked';
type SnapshotSeatView = {
  code: string;
  row: number;
  col: number;
  isActive: boolean;
  price: number;
  status: SeatStatus;
};

@Injectable()
export class TripSeatsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripSeat)
    private readonly tripSeatRepo: Repository<TripSeat>,
    private readonly seatLockService: SeatLockService,
  ) {}

  async getSeatMap(tripId: number) {
    const [trip, tripSeats] = await Promise.all([
      this.tripRepo.findOne({
        where: { id: tripId },
        relations: ['route', 'bus', 'bus.seatMap'],
      }),
      this.tripSeatRepo.find({
        where: { trip: { id: tripId } },
        relations: ['seat'],
      }),
    ]);

    if (!trip) throw new NotFoundException('Trip not found');
    if (!trip.bus?.seatMap)
      throw new BadRequestException('Trip has no seat map');
    if (!tripSeats.length) {
      throw new BadRequestException('Trip has no seat snapshot');
    }

    const seatCodes = tripSeats.map((tripSeat) => tripSeat.seatCodeSnapshot);
    let locks = new Map<string, string | null>();
    try {
      locks = await this.seatLockService.getLockTokens(tripId, seatCodes);
    } catch {
      locks = new Map();
    }

    const seats = tripSeats
      .map<SnapshotSeatView>((tripSeat) => ({
        code: tripSeat.seatCodeSnapshot,
        row: tripSeat.seat.row,
        col: tripSeat.seat.col,
        isActive: tripSeat.seat.isActive,
        price: trip.basePrice,
        status: !tripSeat.seat.isActive
          ? 'inactive'
          : tripSeat.isBooked
            ? 'booked'
            : tripSeat.checkoutBookingId || locks.get(tripSeat.seatCodeSnapshot)
              ? 'held'
              : 'available',
      }))
      .sort((a, b) => a.row - b.row || a.col - b.col);

    const seatMap = trip.bus.seatMap;

    return {
      trip: {
        id: trip.id,
        basePrice: trip.basePrice,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
        realStatus: getRealTripStatus(trip),
        route: trip.route,
        bus: trip.bus,
      },
      seatMap: {
        id: seatMap.id,
        name: seatMap.name,
        rows: seatMap.rows,
        cols: seatMap.cols,
      },
      seats,
    };
  }
}
