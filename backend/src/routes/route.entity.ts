import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { City } from '../cities/city.entity';
import { RouteStop } from './route-stop.entity';

@Entity({ name: 'routes' })
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => City, { eager: true })
  @JoinColumn({ name: 'origin_city_id' })
  originCity: City;

  @ManyToOne(() => City, { eager: true })
  @JoinColumn({ name: 'destination_city_id' })
  destinationCity: City;

  @Column({ type: 'int' })
  estimatedDurationMinutes: number;

  @OneToMany(() => RouteStop, (stop) => stop.route, { cascade: true })
  stops: RouteStop[];
}

