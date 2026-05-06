import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { TripStatus } from '../trip.entity';

export class CreateTripDto {
  @IsInt()
  @IsPositive()
  routeId: number;

  @IsInt()
  @IsPositive()
  busId: number;

  @IsDateString()
  departureTime: string;

  @IsDateString()
  arrivalTime: string;

  @IsInt()
  @IsPositive()
  basePrice: number;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
