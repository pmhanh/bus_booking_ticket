import { Booking } from '../../sales/bookings/entities/booking.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  USER = 'user',
}
export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}
export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  BANNED = 'banned',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  passwordHash?: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ type: 'text', nullable: true })
  avatarPublicId?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.LOCAL })
  provider: AuthProvider;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ default: false })
  verified: boolean;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
