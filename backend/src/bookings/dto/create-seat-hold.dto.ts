import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSeatHoldDto {
  @IsInt()
  @IsPositive()
  tripId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  seats!: string[];

  @IsOptional()
  @IsInt()
  ttlSeconds?: number;
}
