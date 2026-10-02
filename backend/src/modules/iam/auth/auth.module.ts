import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../../../infrastructure/mail/mail.module';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { RefreshSessionService } from './refresh-session.service';
import { OAuthStateService } from './oauth-state.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { AuthConfigService } from './auth-config.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    MailModule,
    RedisModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GoogleAuthGuard,
    RefreshSessionService,
    OAuthStateService,
    AuthConfigService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
