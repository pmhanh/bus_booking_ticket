import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SeatDto {
  @IsString()
  code: string;

  @IsInt()
  @Min(1)
  row: number;

  @IsInt()
  @Min(1)
  col: number;

  @IsInt()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
