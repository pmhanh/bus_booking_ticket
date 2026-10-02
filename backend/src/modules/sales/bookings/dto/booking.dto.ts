import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsBoolean,
  IsString,
  MaxLength,
  ValidateIf,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
  ValidateNested,
  IsPhoneNumber,
  Matches,
  IsEnum,
  Max,
  Min,
  IsIn,
} from 'class-validator';
import { normalizeEmail } from '../../../../core/utils/email.util';
import { DATE_ONLY_PATTERN } from '../../../../core/utils/date.util';
import { BookingStatus } from '../entities/booking.entity';
import { RefundMethod } from '../../payments/entities/payment.entity';

export class BookingPassengerDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  seatCode: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(50)
  idNumber?: string;
}

export class CreateBookingDto {
  @IsInt()
  @IsPositive()
  tripId: number;

  @IsUUID()
  lockToken: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactName: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers: BookingPassengerDto[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  pickupStopId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  dropoffStopId?: number;
}

export class UpdateBookingDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  verificationEmail?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  verificationPhone?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  contactEmail?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BookingPassengerDto)
  passengers?: BookingPassengerDto[];
}

export class CancelBookingDto {
  @IsOptional()
  @IsBoolean()
  pendingOnly?: boolean;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}

export class LookupBookingDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsPhoneNumber('VN', { message: 'Invalid phone' })
  phone?: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'tripDate must use YYYY-MM-DD' })
  tripDate: string;
}

export class ListBookingsDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'fromDate must use YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'toDate must use YYYY-MM-DD' })
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class UpdateBookingStatusDto {
  @IsIn([BookingStatus.CONFIRMED, BookingStatus.CANCELLED])
  status: BookingStatus;
}

export class ProcessRefundDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{1,100}$/)
  requestId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsEnum(RefundMethod)
  method: RefundMethod;
}
