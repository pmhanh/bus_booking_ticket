import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { BusType } from '../bus.entity';

export class CreateBusDto {
  @IsString()
  name: string;

  @IsString()
  plateNumber: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seatMapId?: number | null;

  @IsOptional()
  @IsIn(Object.values(BusType))
  busType?: BusType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
