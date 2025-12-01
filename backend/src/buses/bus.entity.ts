import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SeatMap } from '../seat-maps/seat-map.entity';

@Entity({ name: 'buses' })
export class Bus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  plateNumber: string;

  @ManyToOne(() => SeatMap, { nullable: true, eager: true })
  @JoinColumn({ name: 'seat_map_id' })
  seatMap?: SeatMap | null;
}
