import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SeatMap } from '../seat-maps/seat-map.entity';

export enum BusType {
  SEATER = 'SEATER',
  SLEEPER = 'SLEEPER',
  VIP = 'VIP',
  LIMOUSINE = 'LIMOUSINE',
}


@Entity({ name: 'buses' })
export class Bus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  plateNumber: string;

  @Column({ type: 'enum', enum: BusType, default: BusType.SEATER })
  busType: BusType;

  @Column('text', { array: true, default: '{}' })
  amenities: string[];

  @ManyToOne(() => SeatMap, { nullable: true, eager: true })
  @JoinColumn({ name: 'seat_map_id' })
  seatMap?: SeatMap | null;
}
