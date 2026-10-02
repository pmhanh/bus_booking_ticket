import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { BusType } from '../bus.entity';

export class CreateBusDto {
  @IsString()
  name: string;

  @IsString()
  plateNumber: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  seatMapId: number;

  @IsOptional()
  @IsIn(Object.values(BusType))
  busType?: BusType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
