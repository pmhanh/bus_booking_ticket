import { Type } from 'class-transformer';
import { IsInt, IsPositive, IsString } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  originCityId: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  destinationCityId: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  estimatedDurationMinutes: number;
}
