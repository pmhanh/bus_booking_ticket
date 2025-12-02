import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from '../routes/route.entity';
import { Bus } from '../buses/bus.entity';

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
  status: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}
