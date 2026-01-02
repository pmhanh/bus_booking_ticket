import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatDto } from './seat.dto';

export class CreateSeatMapDto {
  @IsString()
  name: string;

  @IsInt()
  @IsPositive()
  rows: number;

  @IsInt()
  @IsPositive()
  cols: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats: SeatDto[];
}