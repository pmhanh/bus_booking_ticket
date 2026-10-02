import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SeatDefinition } from '../../fleet/seat-maps/seat-definition.entity';
import { Trip } from '../trips/trip.entity';

@Entity({ name: 'trip_seats' })
@Unique(['trip', 'seat'])
@Index('idx_trip_seats_trip', ['trip'])
@Index('idx_trip_seats_trip_booked', ['trip', 'isBooked'])
export class TripSeat {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => SeatDefinition, { eager: true })
  @JoinColumn({ name: 'seat_definition_id' })
  seat: SeatDefinition;

  @Column({ type: 'uuid', nullable: true })
  checkoutBookingId?: string | null;

  @Column({ type: 'boolean', default: false })
  isBooked: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  bookedAt: Date | null;

  @Column({ type: 'varchar', length: 16 })
  seatCodeSnapshot: string;
}
