import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SeatDto } from './seat.dto';

export class CreateSeatMapDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Tên sơ đồ ghế phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Vui lòng nhập tên sơ đồ ghế.' })
  name: string;

  @IsInt()
  @IsPositive()
  rows: number;

  @IsInt()
  @IsPositive()
  cols: number;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats: SeatDto[];
}
