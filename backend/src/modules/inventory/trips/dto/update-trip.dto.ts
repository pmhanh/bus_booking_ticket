import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
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
  @Type(() => Date)
  @IsDate()
  departureTime?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  arrivalTime?: Date;

  @IsOptional()
  @IsInt()
  @IsPositive()
  basePrice?: number;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}
