import { IsDateString, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';

export class GuestLookupDto {
  @IsOptional()
  @IsString()
  @Length(4, 20)
  bookingRef?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('VN', { message: 'Invalid phone' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(5, 120)
  email?: string;

  @IsOptional()
  @IsDateString()
  tripDate?: string;
}
