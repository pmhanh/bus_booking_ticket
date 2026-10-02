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
@Unique('UQ_seat_definition_map_code', ['seatMap', 'code'])
@Unique('UQ_seat_definition_map_position', ['seatMap', 'row', 'col'])
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

  @Column({ default: true })
  isActive: boolean;
}
