import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MomoConfig {
  constructor(private readonly config: ConfigService) {}

  get partnerCode() { return this.config.get<string>('MOMO_PARTNER_CODE')!; }
  get accessKey() { return this.config.get<string>('MOMO_ACCESS_KEY')!; }
  get secretKey() { return this.config.get<string>('MOMO_SECRET_KEY')!; }

  // sandbox endpoint thường dùng:
  get endpoint() {
    return this.config.get<string>('MOMO_ENDPOINT') || 'https://test-payment.momo.vn/v2/gateway/api/create';
  }

  // redirect user về frontend
  get redirectUrl() { return this.config.get<string>('MOMO_REDIRECT_URL')!; }

  // ipn backend (public url)
  get ipnUrl() { return this.config.get<string>('MOMO_IPN_URL')!; }

  get requestType() {
    // phổ biến: captureWallet
    return this.config.get<string>('MOMO_REQUEST_TYPE') || 'captureWallet';
  }
}
