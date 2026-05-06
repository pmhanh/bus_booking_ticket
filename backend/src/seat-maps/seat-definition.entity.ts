import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SeatMap } from './seat-map.entity';

export enum SeatType {
  STANDARD = 'standard',
  VIP = 'vip',
  SLEEPER = 'sleeper',
  WHEELCHAIR = 'wheelchair',
}

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

  @Column({ default: SeatType.STANDARD, type: 'enum', enum: SeatType })
  seatType: SeatType;

  @Column({ default: true })
  isActive: boolean;
}
 