import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { ProcessRefundDto } from './dto/process-refund.dto';

@Injectable()
export class AdminBookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  async list(params?: {
    status?: BookingStatus;
    fromDate?: string;
    toDate?: string;
    tripId?: number;
    routeId?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.trip', 'trip')
      .leftJoinAndSelect('trip.route', 'route')
      .leftJoinAndSelect('route.originCity', 'originCity')
      .leftJoinAndSelect('route.destinationCity', 'destinationCity')
      .leftJoinAndSelect('booking.details', 'details')
      .leftJoinAndSelect('details.tripSeat', 'tripSeat')
      .orderBy('booking.createdAt', 'DESC');

    if (params?.status) {
      qb.andWhere('booking.status = :status', { status: params.status });
    }

    if (params?.tripId) {
      qb.andWhere('trip.id = :tripId', { tripId: params.tripId });
    }

    if (params?.routeId) {
      qb.andWhere('route.id = :routeId', { routeId: params.routeId });
    }

    if (params?.fromDate) {
      qb.andWhere('booking.createdAt >= :fromDate', {
        fromDate: new Date(params.fromDate),
      });
    }

    if (params?.toDate) {
      qb.andWhere('booking.createdAt <= :toDate', {
        toDate: new Date(params.toDate),
      });
    }

    if (params?.search) {
      qb.andWhere(
        '(booking.contactName ILIKE :search OR booking.contactEmail ILIKE :search OR booking.reference ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    if (params?.limit) qb.take(params.limit);
    if (params?.offset) qb.skip(params.offset);

    const [bookings, total] = await qb.getManyAndCount();

    return {
      data: bookings,
      total,
      limit: params?.limit || total,
      offset: params?.offset || 0,
    };
  }

  async findByReference(reference: string) {
    const booking = await this.bookingRepo.findOne({
      where: { reference },
      relations: [
        'trip',
        'trip.route',
        'trip.route.originCity',
        'trip.route.destinationCity',
        'trip.route.stops',
        'trip.route.stops.city',
        'trip.bus',
        'trip.bus.seatMap',
        'details',
        'details.tripSeat',
      ],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Get payment info
    const payment = await this.paymentRepo.findOne({
      where: { bookingId: booking.id },
    });

    return {
      ...booking,
      payment,
    };
  }

  async updateStatus(reference: string, dto: UpdateBookingStatusDto) {
    const booking = await this.bookingRepo.findOne({
      where: { reference },
      relations: ['details', 'details.tripSeat'],
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === dto.status) {
      throw new BadRequestException(`Booking is already ${dto.status}`);
    }

    // Handle status transitions
    if (dto.status === 'CANCELLED') {
      // Release seats
      for (const detail of booking.details) {
        detail.tripSeat.isBooked = false;
        detail.tripSeat.bookedAt = null;
      }
    }

    booking.status = dto.status;

    return this.bookingRepo.save(booking);
  }

  async processRefund(reference: string, dto: ProcessRefundDto) {
    const booking = await this.bookingRepo.findOne({
      where: { reference },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const payment = await this.paymentRepo.findOne({
      where: { bookingId: booking.id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this booking');
    }

    if (payment.status === 'REFUNDED') {
      throw new BadRequestException('Payment has already been refunded');
    }

    if (dto.amount > payment.amount) {
      throw new BadRequestException(
        'Refund amount cannot exceed payment amount',
      );
    }

    // Process refund
    payment.status = 'REFUNDED';
    payment.refundAmount = dto.amount;
    payment.refundReason = dto.reason;
    payment.refundMethod = dto.method;
    payment.refundedAt = new Date();

    await this.paymentRepo.save(payment);

    // Update booking status if not already cancelled
    if (booking.status !== 'CANCELLED') {
      booking.status = 'CANCELLED';
      await this.bookingRepo.save(booking);
    }

    return {
      ok: true,
      message: 'Refund processed successfully',
      refund: {
        amount: payment.refundAmount,
        method: payment.refundMethod,
        processedAt: payment.refundedAt,
      },
    };
  }
}
