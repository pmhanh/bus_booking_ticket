import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';
import { Booking } from '../bookings/booking.entity';
import { Review } from '../reviews/review.entity';

@Entity({ name: 'trips' })
export class Trip {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Route, { eager: true })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @ManyToOne(() => Bus, { eager: true })
  @JoinColumn({ name: 'bus_id' })
  bus: Bus;

  @Column({ type: 'timestamptz' })
  departureTime: Date;

  @Column({ type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ type: 'int' })
  basePrice: number;

  @Column({ type: 'varchar', default: 'SCHEDULED' })
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @OneToMany(() => Booking, (booking) => booking.trip)
  bookings: Booking[];

  @OneToMany(() => Review, (r) => r.trip)
  reviews: Review[];
}
