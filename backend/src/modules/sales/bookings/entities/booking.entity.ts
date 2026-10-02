import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Trip } from '../../../inventory/trips/trip.entity';
import { BookingDetail } from './booking-detail.entity';
import { RouteStop } from '../../../fleet/routes/route-stop.entity';
import { User } from '../../../iam/users/user.entity';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'bookings' })
@Unique(['reference'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  reference?: string | null;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column()
  contactName: string;

  @Column()
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone?: string;

  @Column({ type: 'int' })
  totalPrice: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'timestamptz', nullable: true })
  checkoutExpiresAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  paidPaymentId?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lockToken?: string | null;

  @ManyToOne(() => RouteStop, { nullable: true })
  @JoinColumn({ name: 'pickup_stop_id' })
  pickupStop?: RouteStop | null;

  @ManyToOne(() => RouteStop, { nullable: true })
  @JoinColumn({ name: 'dropoff_stop_id' })
  dropoffStop?: RouteStop | null;

  @OneToMany(() => BookingDetail, (d) => d.booking, { cascade: true })
  details: BookingDetail[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
