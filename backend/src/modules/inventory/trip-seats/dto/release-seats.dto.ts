import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ReleaseSeatsDto {
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((code) => (typeof code === 'string' ? code.trim() : code))
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(16, { each: true })
  seatCodes: string[];

  @IsUUID()
  lockToken: string;
}
