import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'agent' | 'user';
export type AuthProvider = 'local' | 'google';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  passwordHash?: string;

  @Column({ nullable: true })
  fullName?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ default: 'user' })
  role: UserRole;

  @Column({ default: 'local' })
  provider: AuthProvider;

  @Column({ default: 'active' })
  status: 'active' | 'suspended';

  @Column({ nullable: true })
  avatarUrl?: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'text', nullable: true })
  refreshTokenHash?: string | null;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
