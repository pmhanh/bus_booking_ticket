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
import { Trip } from './trip.entity';

@Entity({ name: 'seat_locks' })
@Index(['trip', 'seatCode'])
@Index(['lockToken'])
export class SeatLock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column()
  seatCode: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  guestSessionId?: string;

  @Column({ type: 'uuid' })
  lockToken: string;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'RELEASED';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
