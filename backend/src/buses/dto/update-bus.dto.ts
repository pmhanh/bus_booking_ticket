import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { BusType } from '../bus.entity';
import { Column } from 'typeorm/browser/decorator/columns/Column.js';

export class UpdateBusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsIn(Object.values(BusType))
  busType?: BusType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
