import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  originCityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  destinationCityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  estimatedDurationMinutes?: number;
}
