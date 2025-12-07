import { IsEmail, IsOptional, IsString } from 'class-validator';

export class LookupBookingDto {
  @IsString()
  reference: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
