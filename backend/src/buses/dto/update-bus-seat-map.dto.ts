import { Type } from 'class-transformer';
import { IsInt, IsOptional, ValidateIf } from 'class-validator';

export class UpdateBusSeatMapDto {
  @ValidateIf((o) => o.seatMapId !== null)
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  seatMapId?: number | null;
}