import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingPassengerDto {
  @IsString()
  @IsNotEmpty()
  seatCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  price?: number;
}

export class CreateBookingDto {
  @Type(() => Number)
  @IsNumber()
  tripId!: number;

  @IsString()
  @IsNotEmpty()
  contactName!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  seats!: BookingPassengerDto[];
}
