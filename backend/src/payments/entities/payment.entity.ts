import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentProvider = 'MOMO' | 'STRIPE';
export type PaymentStatus = 'INIT' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

@Entity({ name: 'payments' })
@Index('idx_payments_booking', ['bookingId'])
@Index('idx_payments_order', ['orderId'], { unique: true })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  bookingId: string;

  @Column({ type: 'varchar' })
  provider: PaymentProvider;

  @Column({ type: 'varchar', default: 'INIT' })
  status: PaymentStatus;

  @Column({ type: 'int' })
  amount: number;

  // MoMo fields
  @Column({ type: 'varchar' })
  orderId: string;

  @Column({ type: 'varchar' })
  requestId: string;

  @Column({ type: 'varchar', nullable: true })
  payUrl?: string;

  @Column({ type: 'varchar', nullable: true })
  deeplink?: string;

  @Column({ type: 'varchar', nullable: true })
  qrCodeUrl?: string;

  @Column({ type: 'bigint', nullable: true })
  transId?: string;

  @Column({ type: 'int', nullable: true })
  resultCode?: number;

  @Column({ type: 'varchar', nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  raw?: any;

  // Refund fields
  @Column({ type: 'int', nullable: true })
  refundAmount?: number;

  @Column({ type: 'text', nullable: true })
  refundReason?: string;

  @Column({ type: 'varchar', nullable: true })
  refundMethod?: 'MANUAL' | 'GATEWAY';

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
