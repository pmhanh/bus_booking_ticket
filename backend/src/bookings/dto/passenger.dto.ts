import { IsOptional, IsString } from 'class-validator';

export class PassengerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  seatCode?: string;
}
