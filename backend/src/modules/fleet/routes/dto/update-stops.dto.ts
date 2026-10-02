import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RouteStopType } from '../route-stop.entity';

export class StopItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id?: number;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  cityId: number;

  @IsEnum(RouteStopType)
  type: RouteStopType;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  order: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  estimatedOffsetMinutes: number;
}

export class UpdateStopsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StopItemDto)
  stops: StopItemDto[];
}
