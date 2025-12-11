import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LookupBookingDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
