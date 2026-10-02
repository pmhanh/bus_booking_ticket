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
      where: { trip: { id: tripId } },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    const avg =
      rows.length === 0
        ? 0
        : rows.reduce((sum, review) => sum + (review.rating ?? 0), 0) /
          rows.length;

    return {
      items: rows.map((review) => ({
        id: review.id,
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt,
        user: {
          id: review.user?.id,
          fullName: review.user?.fullName,
          email: review.user?.email,
        },
      })),
      avgRating: avg,
      count: rows.length,
    };
  }

  async create(tripId: number, userId: string, dto: CreateReviewDto) {
    const exists = await this.reviewRepo.findOne({
      where: { trip: { id: tripId }, user: { id: userId } },
    });
    if (exists) {
      throw new BadRequestException('Bạn đã đánh giá chuyến đi này rồi');
    }

    const review = this.reviewRepo.create({
      trip: { id: tripId } as Review['trip'],
      user: { id: userId } as Review['user'],
      rating: dto.rating,
      content: dto.content,
    });
    return this.reviewRepo.save(review);
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['user'],
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá');
    if (review.user?.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền sửa đánh giá này');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.content !== undefined) review.content = dto.content;
    return this.reviewRepo.save(review);
  }

  async remove(reviewId: string, userId: string) {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: ['user'],
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá');
    if (review.user?.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    await this.reviewRepo.delete({ id: reviewId });
    return { ok: true };
  }
}
