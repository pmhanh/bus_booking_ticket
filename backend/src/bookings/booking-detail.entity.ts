import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Booking } from './booking.entity';
import { TripSeat } from '../trips/trip-seat.entity';

@Entity({ name: 'booking_details' })
@Unique(['booking', 'tripSeat'])
@Index('idx_booking_details_booking', ['booking'])
@Index('idx_booking_details_tripSeat', ['tripSeat'])
export class BookingDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Booking, (b) => b.details, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => TripSeat, { eager: true })
  @JoinColumn({ name: 'trip_seat_id' })
  tripSeat: TripSeat;

  @Column({ type: 'varchar', length: 16 })
  seatCodeSnapshot: string;

  @Column({ type: 'int' })
  priceSnapshot: number;

  @Column()
  passengerName: string;

  @Column({ nullable: true })
  passengerPhone?: string;

  @Column({ nullable: true })
  passengerIdNumber?: string;
}
