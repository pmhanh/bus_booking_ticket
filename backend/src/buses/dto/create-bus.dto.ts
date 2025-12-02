import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateBusDto {
  @IsString()
  name: string;

  @IsString()
  plateNumber: string;

  @IsOptional()
  seatMapId?: number | null;

  @IsOptional()
  @IsString()
  busType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
