import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BusType } from '../../../fleet/buses/bus.entity';

export class SearchTripsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  originId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  destinationId?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(BusType)
  busType?: BusType;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : value !== undefined ? [value] : undefined,
  )
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsIn(['price', 'time', 'duration'])
  sortBy?: 'price' | 'time' | 'duration';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}
