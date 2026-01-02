import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Route } from './route.entity';
import { City } from '../cities/city.entity';

@Entity({ name: 'route_stops' })
@Unique(['route', 'order'])
export class RouteStop {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Route, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @ManyToOne(() => City, { eager: true })
  @JoinColumn({ name: 'city_id' })
  city: City;

  @Column({ type: 'varchar'})
  type: 'PICKUP' | 'DROPOFF';

  @Column({ type: 'int' })
  order: number;

  @Column({ type: 'int' })
  estimatedOffsetMinutes: number;
}
