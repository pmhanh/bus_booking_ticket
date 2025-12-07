import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Trip } from '../trips/trip.entity';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

@Entity({ name: 'bookings' })
@Unique(['reference'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reference: string;

  @ManyToOne(() => Trip, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ type: 'text', array: true })
  seats: string[];

  @Column({ nullable: true })
  userId?: string;

  @Column()
  contactName: string;

  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone?: string;

  @Column({ type: 'jsonb', nullable: true })
  passengers?: Array<{ name: string; phone?: string; idNumber?: string; seatCode?: string }>;

  @Column({ type: 'int' })
  totalPrice: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: BookingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
