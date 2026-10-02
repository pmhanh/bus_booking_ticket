import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { GoogleIdentity } from '../google-auth.types';
import { AuthConfigService } from '../auth-config.service';

type GoogleProfile = {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string; verified?: boolean }>;
  photos?: Array<{ value: string }>;
  _json?: { email_verified?: boolean };
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(authConfig: AuthConfigService) {
    super({
      clientID: authConfig.googleClientId,
      clientSecret: authConfig.googleClientSecret,
      callbackURL: authConfig.googleRedirectUri,
      scope: ['openid', 'email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ): GoogleIdentity {
    const email = profile.emails?.[0]?.value;
    const emailVerified =
      profile._json?.email_verified === true ||
      profile.emails?.[0]?.verified === true;

    if (!email || !emailVerified) {
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    return {
      providerId: profile.id,
      email,
      emailVerified,
      fullName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
    };
  }
}
