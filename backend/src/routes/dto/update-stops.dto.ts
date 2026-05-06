import { ArrayNotEmpty, IsArray, IsEnum, IsInt, IsPositive, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RouteStopType } from '../../routes/route-stop.entity';

class StopItemDto {
  @IsInt()
  @IsPositive()
  cityId: number;

  @IsEnum(RouteStopType)
  type: RouteStopType;

  @IsInt()
  @IsPositive()
  order: number;

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
