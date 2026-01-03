import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async listByTrip(tripId: number) {
    const rows = await this.reviewRepo.find({
      where: { tripId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    const avg =
      rows.length === 0
        ? 0
        : rows.reduce((s, r) => s + (r.rating ?? 0), 0) / rows.length;

    return {
      items: rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        user: { id: r.userId, fullName: (r.user as any)?.fullName, email: (r.user as any)?.email },
      })),
      avgRating: avg,
      count: rows.length,
    };
  }

  async create(tripId: number, userId: string, dto: CreateReviewDto) {
    const exists = await this.reviewRepo.findOne({ where: { tripId, userId } });
    if (exists) throw new BadRequestException('Bạn đã review chuyến này rồi');

    const review = this.reviewRepo.create({
      tripId,
      userId,
      rating: dto.rating,
      content: dto.content,
    });
    return this.reviewRepo.save(review);
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const r = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!r) throw new NotFoundException('Review not found');
    if (r.userId !== userId) throw new ForbiddenException('Không có quyền sửa review này');

    if (dto.rating !== undefined) r.rating = dto.rating;
    if (dto.content !== undefined) r.content = dto.content;
    return this.reviewRepo.save(r);
  }

  async remove(reviewId: string, userId: string) {
    const r = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!r) throw new NotFoundException('Review not found');
    if (r.userId !== userId) throw new ForbiddenException('Không có quyền xoá review này');

    await this.reviewRepo.delete({ id: reviewId });
    return { ok: true };
  }
}
