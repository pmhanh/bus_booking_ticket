import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SeatMap } from './seat-map.entity';

@Entity({ name: 'seat_definitions' })
@Unique(['seatMap', 'code'])
export class SeatDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SeatMap, (map) => map.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seat_map_id' })
  seatMap: SeatMap;

  @Column()
  code: string;

  @Column({ type: 'int' })
  row: number;

  @Column({ type: 'int' })
  col: number;

  @Column({ type: 'int' })
  price: number;

  @Column({ default: true })
  isActive: boolean;
}
