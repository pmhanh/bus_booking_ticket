import { Booking } from 'src/bookings/booking.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentProvider {
  STRIPE = 'STRIPE',
}

export enum PaymentStatus {
  INIT = 'INIT',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum RefundMethod {
  MANUAL = 'MANUAL',
  GATEWAY = 'GATEWAY',
}

@Entity({ name: 'payments' })
@Index('idx_payments_booking', ['booking'])
@Index('idx_payments_order', ['orderId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ type: 'enum', enum: PaymentProvider })
  provider: PaymentProvider;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.INIT })
  status: PaymentStatus;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar' })
  orderId: string;

  @Column({ type: 'varchar', nullable: true })
  stripePaymentIntentId?: string;

  @Column({ type: 'varchar', nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  raw?: any;

  @Column({ type: 'int', nullable: true })
  refundAmount?: number;

  @Column({ type: 'text', nullable: true })
  refundReason?: string;

  @Column({ type: 'enum', enum: RefundMethod, nullable: true })
  refundMethod?: RefundMethod;

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
