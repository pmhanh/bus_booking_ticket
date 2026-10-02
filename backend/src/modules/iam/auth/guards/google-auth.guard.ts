import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { OAuthStateService } from '../oauth-state.service';
import type { GoogleIdentity } from '../google-auth.types';
import { AuthConfigService } from '../auth-config.service';

export const OAUTH_STATE_COOKIE = 'oauth_state';

export type GoogleOAuthRequest = Request & {
  oauthState?: string;
  oauthReturnTo?: string;
  user?: GoogleIdentity;
};

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly oauthStateService: OAuthStateService,
    private readonly authConfig: AuthConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const code = this.queryValue(request.query.code);
    const providerError = this.queryValue(request.query.error);

    if (!code && !providerError) {
      request.oauthState = await this.oauthStateService.create(
        this.queryValue(request.query.returnTo),
      );
      response.cookie(
        OAUTH_STATE_COOKIE,
        request.oauthState,
        this.authConfig.oauthStateCookieOptions(
          this.oauthStateService.ttlMilliseconds,
        ),
      );
    } else {
      const state = this.queryValue(request.query.state);
      request.oauthReturnTo = await this.oauthStateService.consume(
        state,
        request.cookies?.[OAUTH_STATE_COOKIE] as string | undefined,
      );
      response.clearCookie(
        OAUTH_STATE_COOKIE,
        this.authConfig.oauthStateCookieOptions(
          this.oauthStateService.ttlMilliseconds,
        ),
      );

      if (providerError) {
        throw new UnauthorizedException('Đăng nhập Google đã bị hủy');
      }
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<GoogleOAuthRequest>();
    return request.oauthState
      ? { state: request.oauthState, prompt: 'select_account' }
      : undefined;
  }

  private queryValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
