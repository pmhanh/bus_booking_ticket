import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export type BookingPassenger = {
  seatCode: string;
  name: string;
  phone?: string;
  idNumber?: string;
  price: number;
};

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  referenceCode: string;

  @ManyToOne(() => Trip, { eager: true })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column()
  contactName: string;

  @Column({ type: 'varchar', nullable: true })
  contactEmail?: string | null;

  @Column({ type: 'varchar' })
  contactPhone: string;

  @Column({ type: 'jsonb' })
  passengers: BookingPassenger[];

  @Column({ type: 'int' })
  totalPrice: number;

  @Column({ type: 'varchar', default: 'CONFIRMED' })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
