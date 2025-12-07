import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class RefreshLockDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  holdMinutes?: number;
}
