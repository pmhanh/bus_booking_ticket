import { IsEnum, IsInt, IsString, Min } from 'class-validator';
import { RefundMethod } from '../../payments/entities/payment.entity';

export class ProcessRefundDto {
  @IsInt()
  @Min(0)
  amount: number;

  @IsString()
  reason: string;

  @IsEnum(RefundMethod)
  method: RefundMethod;
}
