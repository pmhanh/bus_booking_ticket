import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusType } from '../bus.entity';

export class UpdateBusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsIn(Object.values(BusType))
  busType?: BusType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  // PATCH: omitted means "keep the current seat map"; null is invalid.
  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  seatMapId?: number;
}
