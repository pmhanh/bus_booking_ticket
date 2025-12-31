import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatLockService } from '../redis/seat-lock.service';
import { Trip } from './trip.entity';
import { SeatMap } from '../seat-maps/seat-map.entity';
import { TripSeat } from './trip-seat.entity';

type SeatStatus = 'available' | 'inactive' | 'held' | 'booked';

@Injectable()
export class TripSeatsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(SeatMap) private readonly seatMapRepo: Repository<SeatMap>,
    @InjectRepository(TripSeat) private readonly tripSeatRepo: Repository<TripSeat>,
    private readonly seatLockService: SeatLockService,
  ) {}

  async getSeatMap(tripId: number) {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['route', 'bus', 'bus.seatMap'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    const seatMapId = trip.bus?.seatMap?.id;
    if (!seatMapId) throw new BadRequestException('Trip has no seat map assigned');

    const seatMap = await this.seatMapRepo.findOne({
      where: { id: seatMapId },
      relations: ['seats'],
      order: { seats: { row: 'ASC', col: 'ASC' } },
    });
    if (!seatMap) throw new NotFoundException('Seat map not found');

    const tripSeats = await this.tripSeatRepo.find({
      where: { trip: { id: tripId } },
      relations: ['seat'],
    });

    const codeToTripSeat = new Map<string, TripSeat>();
    for (const ts of tripSeats) codeToTripSeat.set(ts.seatCodeSnapshot, ts);

    const seatCodes = seatMap.seats.map((s) => s.code);
    let locks = new Map<string, string | null>();
    try {
      locks = await this.seatLockService.getLockTokens(tripId, seatCodes);
    } catch {
      locks = new Map();
    }

    const seats = seatMap.seats.map((sd) => {
      const ts = codeToTripSeat.get(sd.code);
      let status: SeatStatus = 'available';
      if (!sd.isActive) status = 'inactive';
      else if (ts?.isBooked) status = 'booked';
      else if (locks.get(sd.code)) status = 'held';

      return {
        code: sd.code,
        row: sd.row,
        col: sd.col,
        seatType: sd.seatType,
        isActive: sd.isActive,
        // Giá hiển thị theo trip (không dùng giá riêng từng ghế)
        price: ts?.price ?? trip.basePrice,
        status,
      };
    });

    return {
      trip: {
        id: trip.id,
        basePrice: trip.basePrice,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        status: trip.status,
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
