import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SeatDefinition } from './seat-definition.entity';

@Entity({ name: 'seat_maps' })
export class SeatMap {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'int' })
  rows: number;

  @Column({ type: 'int' })
  cols: number;

  @OneToMany(() => SeatDefinition, (seat) => seat.seatMap, { cascade: true })
  seats: SeatDefinition[];
}
