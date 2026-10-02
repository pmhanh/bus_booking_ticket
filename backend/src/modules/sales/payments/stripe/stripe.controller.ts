import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../../../../core/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../../../../core/interfaces/jwt-payload';
import { PaymentsService } from '../payments.service';

export class CreateStripeCheckoutDto {
  @IsUUID()
  bookingId: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

@Controller('payments/stripe')
export class StripeController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create')
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() body: CreateStripeCheckoutDto,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    return this.payments.createStripeCheckout(
      body.bookingId,
      body.email,
      req.user?.sub,
    );
  }
}
