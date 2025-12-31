import {
  IsBoolean,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const SEAT_TYPES = ['standard', 'vip', 'double', 'sleeper'] as const;
export type SeatType = (typeof SEAT_TYPES)[number];

export class SeatDto {
  @IsString()
  code: string;

  @IsInt()
  @Min(1)
  row: number;

  @IsInt()
  @Min(1)
  col: number;

  @IsOptional()
  @IsIn(SEAT_TYPES)
  seatType?: SeatType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

