import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SeatDto } from './seat.dto';

export class UpdateSeatMapDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Tên sơ đồ ghế phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên sơ đồ ghế.' })
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rows?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cols?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats?: SeatDto[];
}
