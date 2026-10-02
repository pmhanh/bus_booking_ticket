import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserStatus, UserRole, AuthProvider } from './user.entity';
import * as bcrypt from 'bcrypt';
import { normalizeEmail } from '../../../core/utils/email.util';
import { CloudinaryService } from '../../../infrastructure/cloudinary/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly images: CloudinaryService,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({
      where: { email: normalizeEmail(email) },
    });
  }

  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  findById(id: string) {
    return this.repo.findOne({
      where: { id },
    });
  }

  findByIdWithPassword(id: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
  }

  async createLocal(dto: CreateUserDto) {
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email: normalizeEmail(dto.email),
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

  async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!(await this.findById(userId))) {
      throw new NotFoundException('User not found');
    }
    const image = await this.images.uploadImage(file, 'avatars');
    let previousPublicId: string | null | undefined;
    let updated: User;
    try {
      updated = await this.repo.manager.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new NotFoundException('User not found');
        previousPublicId = user.avatarPublicId;
        user.avatarUrl = image.url;
        user.avatarPublicId = image.publicId;
        return manager.save(User, user);
      });
    } catch (error) {
      await this.images.cleanupImage(image.publicId);
      throw error;
    }
    await this.images.cleanupImage(previousPublicId);
    return updated;
  }

  async updatePassword(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    await this.repo.update(userId, { passwordHash });
  }

  async verifyUser(userId: string, currentStatus?: UserStatus) {
    const nextStatus =
      currentStatus === UserStatus.BANNED ? currentStatus : UserStatus.ACTIVE;
    await this.repo.update(userId, { verified: true, status: nextStatus });
    return this.findById(userId);
  }

  async createFromProvider(email: string, profile: Partial<User>) {
    email = normalizeEmail(email);
    const existing = await this.findByEmail(email);
    if (existing) {
      existing.fullName = existing.fullName ?? profile.fullName;
      existing.avatarUrl = existing.avatarUrl ?? profile.avatarUrl;
      existing.verified = true;
      if (existing.status !== UserStatus.BANNED) {
        existing.status = UserStatus.ACTIVE;
      }
      return this.repo.save(existing);
    }
    const user = this.repo.create({
      email,
      provider: AuthProvider.GOOGLE,
      verified: true,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
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
