import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TripStatus } from '../trip.entity';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ListTripsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  routeId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  busId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  originCityId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  destinationCityId?: number;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'fromDate must use YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'toDate must use YYYY-MM-DD' })
  toDate?: string;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsIn(['bookings'])
  sortBy?: 'bookings';

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
