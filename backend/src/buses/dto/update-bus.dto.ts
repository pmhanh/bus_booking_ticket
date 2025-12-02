import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateBusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  busType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
