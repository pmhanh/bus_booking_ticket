import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserStatus, UserRole, AuthProvider } from './user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({
      where: { email },
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'phone', 'avatarUrl'],
    });
  }

  findByEmailWithPassword(email: string) {
    return this.repo.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'fullName',
        'role',
        'status',
        'verified',
        'passwordHash',
        'phone',
        'avatarUrl',
      ],
    });
  }

  findById(id: string) {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'phone', 'avatarUrl'],
    });
  }

  findByIdWithPassword(id: string) {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'passwordHash', 'phone', 'avatarUrl'],
    });
  }

  findByIdWithRefreshToken(id: string) {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'role', 'status', 'verified', 'refreshTokenHash', 'phone', 'avatarUrl'],
    });
  }

  async createLocal(dto: CreateUserDto) {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email,
      passwordHash: hash,
      fullName: dto.fullName,
      provider: AuthProvider.LOCAL,
      verified: false,
      status: UserStatus.PENDING,
    });
    return this.repo.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.repo.update(userId, { ...dto });
    return this.findById(userId);
  }

  async updatePassword(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.update(userId, { passwordHash });
  }

  async verifyUser(userId: string, currentStatus?: UserStatus) {
    const nextStatus = currentStatus === UserStatus.BANNED ? currentStatus : UserStatus.ACTIVE;
    await this.repo.update(userId, { verified: true, status: nextStatus });
    return this.findById(userId);
  }

  async setRefreshToken(userId: string, token: string) {
    const refreshTokenHash = await bcrypt.hash(token, 10);
    await this.repo.update(userId, { refreshTokenHash });
  }

  async clearRefreshToken(userId: string) {
    await this.repo.update(userId, { refreshTokenHash: null });
  }

  async createFromProvider(email: string, profile: Partial<User>) {
    const existing = await this.findByEmail(email);
    if (existing) {
      return this.repo.save({
        ...existing,
        ...profile,
        email: existing.email,
        provider: existing.provider,
        verified: true,
      });
    }
    const user = this.repo.create({
      email,
      provider: AuthProvider.GOOGLE,
      verified: true,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      ...profile,
    });
    return this.repo.save(user);
  }

  findAll(filter?: { role?: string; status?: string; search?: string }) {
    const qb = this.repo.createQueryBuilder('user');
    if (filter?.role) qb.andWhere('user.role = :role', { role: filter.role });
    if (filter?.status)
      qb.andWhere('user.status = :status', { status: filter.status });
    if (filter?.search)
      qb.andWhere('user.email ILIKE :s OR user.fullName ILIKE :s', {
        s: `%${filter.search}%`,
      });
    return qb.orderBy('user.createdAt', 'DESC').getMany();
  }

  async updateStatus(userId: string, status: UserStatus) {
    await this.repo.update(userId, { status });
    return this.findById(userId);
  }

  async updateRole(userId: string, role: UserRole) {
    await this.repo.update(userId, { role });
    return this.findById(userId);
  }
}
