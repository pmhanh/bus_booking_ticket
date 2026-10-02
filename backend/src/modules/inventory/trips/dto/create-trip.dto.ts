import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { TripStatus } from '../trip.entity';

export class CreateTripDto {
  @IsInt()
  @IsPositive()
  routeId: number;

  @IsInt()
  @IsPositive()
  busId: number;

  @Type(() => Date)
  @IsDate()
  departureTime: Date;

  @Type(() => Date)
  @IsDate()
  arrivalTime: Date;

  @IsInt()
  @IsPositive()
  basePrice: number;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
