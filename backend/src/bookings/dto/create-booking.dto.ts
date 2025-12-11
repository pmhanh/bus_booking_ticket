import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PassengerDto } from './passenger.dto';

export class CreateBookingDto {
  @IsInt()
  @IsPositive()
  tripId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  seats: string[];

  @IsString()
  @Length(2, 120)
  contactName: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers?: PassengerDto[];

  @IsOptional()
  @IsString()
  lockToken?: string;

  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
