import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { CookieOptions } from 'express';

@Injectable()
export class AuthConfigService {
  readonly frontendUrl: string;
  readonly accessTokenExpiresIn: JwtSignOptions['expiresIn'];
  readonly refreshTokenTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    this.frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    this.accessTokenExpiresIn =
      this.config.get<JwtSignOptions['expiresIn']>('ACCESS_TOKEN_EXPIRES_IN') ??
      '15m';
    this.refreshTokenTtlSeconds = this.parseTtl(
      this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d',
    );
  }

  get refreshCookieOptions(): CookieOptions {
    return this.httpOnlyCookie({
      sameSite: this.isProduction ? 'none' : 'lax',
      maxAge: this.refreshTokenTtlSeconds * 1000,
      path: '/api/auth',
    });
  }

  oauthStateCookieOptions(maxAge: number): CookieOptions {
    return this.httpOnlyCookie({
      sameSite: 'lax',
      maxAge,
      path: '/api/auth/google',
    });
  }

  frontendRedirectUrl(returnTo = '/'): string {
    return new URL(returnTo, this.frontendUrl).toString();
  }

  get googleClientId(): string {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
  }

  get googleClientSecret(): string {
    return this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
  }

  get googleRedirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      'http://localhost:3000/api/auth/google'
    );
  }

  get resetSecret(): string | undefined {
    return this.config.get<string>('RESET_SECRET');
  }

  get verifySecret(): string | undefined {
    return this.config.get<string>('VERIFY_SECRET');
  }

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private httpOnlyCookie(
    options: Pick<CookieOptions, 'sameSite' | 'maxAge' | 'path'>,
  ): CookieOptions {
    return {
      httpOnly: true,
      secure: this.isProduction,
      ...options,
    };
  }

  private parseTtl(value: string): number {
    const match = value
      .trim()
      .toLowerCase()
      .match(/^(\d+)(s|m|h|d)?$/);
    if (!match) return 7 * 24 * 60 * 60;

    const amount = Number(match[1]);
    const unit = match[2] ?? 's';
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * multipliers[unit as keyof typeof multipliers];
  }
}
