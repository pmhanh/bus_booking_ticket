import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { StopItemDto } from './update-stops.dto';

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StopItemDto)
  stops?: StopItemDto[];
}
