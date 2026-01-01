import { Body, Controller, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreateMomoPaymentDto } from './dto/create-momo-payment.dto';
import { MomoIpnDto } from './dto/momo-ipn.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('momo/create')
  create(@Body() dto: CreateMomoPaymentDto) {
    return this.payments.createMomoPayment(dto.bookingId);
  }

  @Post('momo/ipn')
  momoIpn(@Body() dto: MomoIpnDto) {
    return this.payments.handleMomoIpn(dto);
  }
}