import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  content: string;
}

export class UpdateReviewDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  content?: string;
}
