import { IsBoolean } from 'class-validator';

export class UpdateBusStatusDto {
  @IsBoolean()
  isActive: boolean;
}
