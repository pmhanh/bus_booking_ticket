import { IsOptional, IsString } from 'class-validator';

export class UpdateBusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}
