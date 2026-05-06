import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { TripStatus } from '../trip.entity';

export class UpdateTripDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  routeId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  busId?: number;

  @IsOptional()
  @IsDateString()
  departureTime?: string;

  @IsOptional()
  @IsDateString()
  arrivalTime?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  basePrice?: number;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
