import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';

type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;
  private oauthClient: OAuth2Client;
  private mailer?: nodemailer.Transporter;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/api/auth/google/callback';
    this.googleClient = new OAuth2Client(clientId);
    this.oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    if (smtpHost && smtpUser && smtpPass) {
      this.mailer = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }
  }

  private async signTokens(payload: JwtPayload): Promise<Tokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: this.configService.get('JWT_REFRESH_SECRET') || 'refresh-secret',
    });
    await this.usersService.setRefreshToken(payload.sub, refreshToken);
    return { accessToken, refreshToken };
  }

  async register(dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email already registered');
    const user = await this.usersService.createLocal(dto);
    await this.sendVerification(user.email, user.id);
    return {
      ok: true,
      message: 'Verification email sent. Please confirm to log in.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid credentials');
    if (!user.verified)
      throw new ForbiddenException('Please verify your email first.');
    if (user.status === 'suspended')
      throw new ForbiddenException('Account suspended');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account is temporarily locked');
    }
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const lock =
        attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : undefined;
      await this.usersService.updateFailedAttempts(user.id, attempts, lock);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.updateFailedAttempts(user.id, 0, undefined);
    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { user, tokens };
  }

  async googleLogin(dto: GoogleLoginDto) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email)
      throw new UnauthorizedException('Invalid Google token');
    const user = await this.usersService.createFromProvider(payload.email, {
      fullName: payload.name,
      avatarUrl: payload.picture,
      provider: 'google',
      verified: payload.email_verified ?? true,
    });
    if (user.status === 'suspended')
      throw new ForbiddenException('Account suspended');
    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { user, tokens };
  }

  buildGoogleOAuthUrl() {
    return this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'select_account consent',
    });
  }

  async handleGoogleOAuthCode(code: string) {
    try {
      const { tokens } = await this.oauthClient.getToken(code);
      if (!tokens.id_token) throw new UnauthorizedException('Missing id token');
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload?.email)
        throw new UnauthorizedException('Invalid Google token');
      const user = await this.usersService.createFromProvider(payload.email, {
        fullName: payload.name,
        avatarUrl: payload.picture,
        provider: 'google',
        verified: payload.email_verified ?? true,
      });
      const sessionTokens = await this.signTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      return { user, tokens: sessionTokens };
    } catch (err) {
      const reason = (err as Error).message?.includes('redirect_uri_mismatch')
        ? 'Google redirect_uri mismatch. Check GOOGLE_REDIRECT_URI in .env and OAuth console.'
        : (err as Error).message;
      throw new UnauthorizedException(reason || 'Google login failed');
    }
  }

  async refresh(userId: string, refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret:
            this.configService.get('JWT_REFRESH_SECRET') || 'refresh-secret',
        },
      );
      // bảo vệ: id trong token phải khớp với input và với bản ghi DB
      if (userId && payload.sub !== userId) throw new UnauthorizedException();
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.refreshTokenHash) throw new UnauthorizedException();
      const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!match) throw new UnauthorizedException();
      return this.signTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return { ok: true }; // do not leak
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, kind: 'reset' },
      {
        expiresIn: '1h',
        secret: this.configService.get('RESET_SECRET') || 'reset-secret',
      },
    );
    const frontend =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontend}/reset?token=${token}`;

    if (this.mailer) {
      try {
        await this.mailer.sendMail({
          to: user.email,
          from:
            this.configService.get<string>('SMTP_FROM') ||
            this.configService.get<string>('SMTP_USER'),
          subject: 'Reset your password',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:16px;background:#f5f7fb;color:#1f2937;border-radius:12px;border:1px solid #e5e7eb;">
              <h2 style="margin-top:0;color:#111827;">Hello from BusTicket One,</h2>
              <p>We received a request to reset your password. Click the button below to set a new one.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${resetLink}" style="background:#14b8a6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Reset password</a>
              </div>
              <p>If the button doesn't work, copy this link:</p>
              <p style="word-break:break-all;font-size:12px;color:#374151;">${resetLink}</p>
              <p style="font-size:12px;color:#6b7280;">If you didn't request this, you can ignore this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error('Failed to send reset email', err);
      }
    } else {
      console.info(`Reset link for ${user.email}: ${resetLink}`);
    }
    return { ok: true, message: 'Reset email sent if account exists.' };
  }

  private async sendVerification(email: string, userId: string) {
    const token = await this.jwtService.signAsync(
      { sub: userId, email, kind: 'verify' },
      {
        expiresIn: '1h',
        secret: this.configService.get('VERIFY_SECRET') || 'verify-secret',
      },
    );
    const frontend =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verifyLink = `${frontend}/verify?token=${token}`;

    if (this.mailer) {
      try {
        await this.mailer.sendMail({
          to: email,
          from:
            this.configService.get<string>('SMTP_FROM') ||
            this.configService.get<string>('SMTP_USER'),
          subject: 'Verify your email',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:16px;background:#f5f7fb;color:#1f2937;border-radius:12px;border:1px solid #e5e7eb;">
              <h2 style="margin-top:0;color:#111827;">Hello from BusTicket One,</h2>
              <p>Thanks for signing up. Please confirm your email to continue.</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${verifyLink}" style="background:#14b8a6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Verify email</a>
              </div>
              <p>If the button doesn't work, copy this link:</p>
              <p style="word-break:break-all;font-size:12px;color:#374151;">${verifyLink}</p>
              <p style="font-size:12px;color:#6b7280;">If you didn't request this, you can ignore this email.</p>
            </div>
          `,
        });
      } catch (err) {
        console.error('Failed to send verification email', err);
      }
    } else {
      console.info(`Verify link for ${email}: ${verifyLink}`);
    }
    return token;
  }

  async requestVerification(dto: VerifyRequestDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return { ok: true }; // avoid leaking
    if (user.verified) return { ok: true, message: 'Already verified' };
    const token = await this.sendVerification(user.email, user.id);
    return { ok: true, token };
  }

  async verify(dto: VerifyEmailDto) {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      kind: string;
    }>(dto.token, {
      secret: this.configService.get('VERIFY_SECRET') || 'verify-secret',
    });
    if (payload.kind !== 'verify') throw new UnauthorizedException();
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    await this.usersService.verifyUser(user.id);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      kind: string;
    }>(dto.token, {
      secret: this.configService.get('RESET_SECRET') || 'reset-secret',
    });
    if (payload.kind !== 'reset') throw new UnauthorizedException();
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    await this.usersService.clearRefreshToken(user.id);
    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.passwordHash) throw new UnauthorizedException();
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Wrong current password');
    if (dto.newPassword === dto.currentPassword)
      throw new BadRequestException('New password must differ');
    await this.usersService.clearRefreshToken(user.id);
    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { ok: true };
  }
}
