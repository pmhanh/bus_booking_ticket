import {
  ArrayNotEmpty,
  IsDateString,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BookingPassengerItemDto {
  @IsString()
  seatCode: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;
}

export class CreateBookingDto {
  @IsInt()
  @IsPositive()
  tripId: number;

  @IsString()
  lockToken: string;

  @IsString()
  contactName: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerItemDto)
  passengers: BookingPassengerItemDto[];

  @IsDateString()
  holdExpiresAt: string;
}
