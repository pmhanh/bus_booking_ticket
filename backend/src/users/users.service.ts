import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserStatus } from './user.entity';
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
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'phone'] });
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
        'phone'
      ],
    });
  }

  findById(id: string) {
    return this.repo.findOne({ 
      where: { id },
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'phone'] 
    });
  }

  findByIdWithPassword(id: string) {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'fullName', 'role', 'status', 'verified', 'passwordHash', 'phone'],
    });
  }

  findByIdWithRefreshToken(id: string) {
    return this.repo.findOne({
      where: { id },
      select: ['id', 'email', 'role', 'refreshTokenHash', 'phone'],
    });
  }

  async createLocal(dto: CreateUserDto) {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email,
      passwordHash: hash,
      fullName: dto.fullName,
      provider: 'local',
      verified: false,
      status: 'pending',
    });
    return this.repo.save(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    console.log('dto=', dto);
    //await this.repo.update(userId, { ...dto });
    //return this.findById(userId);
    const result = await this.repo.update(userId, { ...dto });
    console.log('affected=', result.affected);
    return this.findById(userId);
  }

  async updatePassword(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.update(userId, { passwordHash });
  }

  async verifyUser(userId: string, currentStatus?: UserStatus) {
    const nextStatus = currentStatus === 'banned' ? currentStatus : 'active';
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
      provider: 'google',
      verified: true,
      role: 'user',
      status: 'active',
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
}
