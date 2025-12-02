import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';

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
  @IsIn(['SCHEDULED', 'CANCELLED', 'COMPLETED'])
  status?: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}
