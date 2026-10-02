import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SeatDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id?: number;

  @IsString()
  code: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  row: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  col: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
