import { IsOptional, IsString } from 'class-validator';

export class CreateBusDto {
  @IsString()
  name: string;

  @IsString()
  plateNumber: string;

  @IsOptional()
  seatMapId?: number | null;
}
