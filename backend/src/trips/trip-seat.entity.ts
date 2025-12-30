import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Trip } from './trip.entity';
import { SeatDefinition } from '../seat-maps/seat-definition.entity';

@Entity({ name: 'trip_seats' })
@Unique(['trip', 'seat'])
@Index('idx_trip_seats_trip', ['trip'])
@Index('idx_trip_seats_trip_booked', ['trip', 'isBooked'])
export class TripSeat {
  @PrimaryGeneratedColumn()
  id: number;

  /* Trip mà seat này thuộc về */
  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  /* SeatDefinition (layout seat) tương ứng: A1, A2... Đây là ghế "tĩnh" của layout. */
  @ManyToOne(() => SeatDefinition, { eager: true })
  @JoinColumn({ name: 'seat_definition_id' })
  seat: SeatDefinition;

  /* Snapshot giá của ghế tại thời điểm trip này. Thường = trip.basePrice + seat.priceDelta (hoặc seat.price hiện tại của bạn)
   */
  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'boolean', default: false })
  isBooked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  bookedAt: Date | null;

  @Column({ type: 'varchar', length: 16 })
  seatCodeSnapshot: string;
}
