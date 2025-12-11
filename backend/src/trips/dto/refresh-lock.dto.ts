import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class RefreshLockDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  holdMinutes?: number;

  @IsOptional()
  @IsString()
  guestSessionId?: string;
}
