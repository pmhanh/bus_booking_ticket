import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class StopItemDto {
  @IsInt()
  @IsPositive()
  cityId: number;

  @IsIn(['PICKUP', 'DROPOFF'])
  type: 'PICKUP' | 'DROPOFF';

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
