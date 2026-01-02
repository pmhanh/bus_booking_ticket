import { IsUUID } from 'class-validator';

export class CreateMomoPaymentDto {
  @IsUUID()
  bookingId: string;
}
