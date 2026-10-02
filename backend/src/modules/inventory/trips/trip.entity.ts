import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Route } from '../../fleet/routes/route.entity';
import { Bus } from '../../fleet/buses/bus.entity';
import { Booking } from '../../sales/bookings/entities/booking.entity';
import { Review } from '../../sales/reviews/review.entity';

export enum TripStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DELAYED = 'DELAYED',
}

@Entity({ name: 'trips' })
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Route)
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @ManyToOne(() => Bus)
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;

  @Index()
  @Column({ type: 'timestamptz' })
  departureTime: Date;

  @Column({ type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ type: 'int' })
  basePrice: number;

  @Index()
  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.SCHEDULED })
  status: TripStatus;

  @OneToMany(() => Booking, (booking) => booking.trip)
  bookings: Booking[];

  @OneToMany(() => Review, (review) => review.trip)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
