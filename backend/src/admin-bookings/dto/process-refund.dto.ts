import { IsEnum, IsInt, IsString, Min } from 'class-validator';

export class ProcessRefundDto {
  @IsInt()
  @Min(0)
  amount: number;

  @IsString()
  reason: string;

  @IsEnum(['MANUAL', 'GATEWAY'])
  method: 'MANUAL' | 'GATEWAY';
}
