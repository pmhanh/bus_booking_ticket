import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class HoldSeatsDto {
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((code) => (typeof code === 'string' ? code.trim() : code))
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(16, { each: true })
  seatCodes: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(900)
  ttlSeconds?: number;
}
