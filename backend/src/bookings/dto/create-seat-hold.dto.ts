import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class CreateSeatHoldDto {
  @IsInt()
  @IsPositive()
  tripId!: number;

  @IsArray()
  @ArrayNotEmpty()
  seats!: string[];

  @IsOptional()
  @IsInt()
  ttlSeconds?: number;
}
