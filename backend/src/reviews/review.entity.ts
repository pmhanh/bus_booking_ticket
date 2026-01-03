import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Trip } from '../trips/trip.entity';
import { User } from '../users/user.entity';

@Entity('reviews')
@Index(['tripId', 'userId'], { unique: true })
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tripId: number;

  @Column()
  userId: string;

  @ManyToOne(() => Trip, (t) => (t as any).reviews, { onDelete: 'CASCADE' })
  trip: Trip;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'int', default: 5 })
  rating: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
