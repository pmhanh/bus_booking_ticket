import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class LockSeatsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  seats: string[];

  @IsOptional()
  @IsInt()
  @IsPositive()
  holdMinutes?: number;

  @IsOptional()
  @IsUUID()
  lockToken?: string;

  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
