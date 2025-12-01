import { IsDateString, IsInt, IsIn, IsOptional, IsPositive } from 'class-validator';

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
  @IsIn(['SCHEDULED', 'CANCELLED', 'COMPLETED'])
  status?: 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';
}
