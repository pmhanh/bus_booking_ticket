import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { BusType } from '../bus.entity';

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
