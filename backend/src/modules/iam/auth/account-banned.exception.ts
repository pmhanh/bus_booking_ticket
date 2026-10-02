import { ForbiddenException } from '@nestjs/common';

export class AccountBannedException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      code: 'ACCOUNT_BANNED',
      message: 'Tài khoản bị cấm',
    });
  }
}
