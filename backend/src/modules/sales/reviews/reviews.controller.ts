import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { JwtPayload } from '../../../core/interfaces/jwt-payload';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';

type AuthedRequest = Request & { user?: JwtPayload };

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('trips/:tripId/reviews')
  list(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.reviewsService.listByTrip(tripId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('trips/:tripId/reviews')
  create(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: CreateReviewDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload;
    return this.reviewsService.create(tripId, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('reviews/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
    @Req() req: AuthedRequest,
  ) {
    const user = req.user as JwtPayload;
    return this.reviewsService.update(id, user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('reviews/:id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    const user = req.user as JwtPayload;
    return this.reviewsService.remove(id, user.sub);
  }
}
