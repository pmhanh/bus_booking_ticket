import { IsArray, IsInt, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SeatDto } from './seat.dto';

export class UpdateSeatMapDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rows?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cols?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats?: SeatDto[];
}
