import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
