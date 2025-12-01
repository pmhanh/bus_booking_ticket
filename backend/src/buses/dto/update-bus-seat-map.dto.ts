import { IsOptional } from 'class-validator';

export class UpdateBusSeatMapDto {
  @IsOptional()
  seatMapId: number | null;
}
