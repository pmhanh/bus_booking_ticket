import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { MailService } from '../mail/mail.service';

type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  private oauthClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri =
      this.configService.get<string>('GOOGLE_REDIRECT_URI') ||
      'http://localhost:3000/api/auth/google/callback';
    this.oauthClient = new OAuth2Client(clientId, clientSecret, redirectUri);
  }

  private async signTokens(payload: JwtPayload): Promise<Tokens> {
    const accessExpiresIn: JwtSignOptions['expiresIn'] =
      this.configService.get<JwtSignOptions['expiresIn']>('ACCESS_TOKEN_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn: JwtSignOptions['expiresIn'] =
      this.configService.get<JwtSignOptions['expiresIn']>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d';
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessExpiresIn,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: refreshExpiresIn,
      secret: this.configService.get('JWT_REFRESH_SECRET'),
    });
    await this.usersService.setRefreshToken(payload.sub, refreshToken);
    return { accessToken, refreshToken };
  }

  async register(dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new BadRequestException('Email đã được sử dụng');
    const user = await this.usersService.createLocal(dto);
    await this.sendVerification(user.email, user.id);
    return {
      ok: true,
      message: 'Đã gửi email xác thực. Vui lòng xác nhận để đăng nhập.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    if (user.status === 'banned')
      throw new ForbiddenException('Tài khoản bị cấm');
    if (user.status === 'pending' || !user.verified)
      throw new ForbiddenException('Vui lòng xác thực email trước khi đăng nhập.');
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk)
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, tokens };
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
      if (!tokens.id_token) throw new UnauthorizedException('Thiếu id token');
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload?.email)
        throw new UnauthorizedException('Token Google không hợp lệ');
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
        ? 'Sai redirect_uri Google. Kiểm tra GOOGLE_REDIRECT_URI trong .env và cấu hình OAuth.'
        : (err as Error).message;
      throw new UnauthorizedException(reason || 'Đăng nhập Google thất bại');
    }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        {
          secret: this.configService.get('JWT_REFRESH_SECRET'),
        },
      );
      const user = await this.usersService.findByIdWithRefreshToken(payload.sub);
      if (!user || !user.refreshTokenHash) throw new UnauthorizedException();
      const match = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!match) throw new UnauthorizedException();
      return this.signTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Không tìm thấy nguời dùng');
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, kind: 'reset' },
      {
        expiresIn: '1h',
        secret: this.configService.get('RESET_SECRET'),
      },
    );
    const frontend =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetLink = `${frontend}/reset?token=${token}`;

    await this.mailService.sendMail({
      to: user.email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:16px;background:#f5f7fb;color:#1f2937;border-radius:12px;border:1px solid #e5e7eb;">
          <h2 style="margin-top:0;color:#111827;">Xin chào bạn,</h2>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Nhấn nút dưới đây để đặt mật khẩu mới.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${resetLink}" style="background:#14b8a6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Đặt lại mật khẩu</a>
          </div>
          <p>Nếu nút không hoạt động, hãy sao chép liên kết này:</p>
          <p style="word-break:break-all;font-size:12px;color:#374151;">${resetLink}</p>
          <p style="font-size:12px;color:#6b7280;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
        </div>
      `,
      fallbackLog: `Reset link cho ${user.email}: ${resetLink}`,
      errorLabel: 'reset email',
    });
    return { ok: true, message: 'Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.' };
  }

  private async sendVerification(email: string, userId: string) {
    const token = await this.jwtService.signAsync(
      { sub: userId, email, kind: 'verify' },
      {
        expiresIn: '1h',
        secret: this.configService.get('VERIFY_SECRET'),
      },
    );
    const frontend =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verifyLink = `${frontend}/verify?token=${token}`;

    await this.mailService.sendMail({
      to: email,
      subject: 'Xác thực email',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:16px;background:#f5f7fb;color:#1f2937;border-radius:12px;border:1px solid #e5e7eb;">
          <h2 style="margin-top:0;color:#111827;">Xin chào bạn,</h2>
          <p>Cảm ơn bạn đã đăng ký. Vui lòng xác nhận email để tiếp tục.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${verifyLink}" style="background:#14b8a6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Xác thực email</a>
          </div>
          <p>Nếu nút không hoạt động, hãy sao chép liên kết này:</p>
          <p style="word-break:break-all;font-size:12px;color:#374151;">${verifyLink}</p>
          <p style="font-size:12px;color:#6b7280;">Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
        </div>
      `,
      fallbackLog: `Liên kết xác thực cho ${email}: ${verifyLink}`,
      errorLabel: 'verification email',
    });
    return token;
  }

  async requestVerification(dto: VerifyRequestDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Không tìm thấy người dùng');
    if (user.verified) return { ok: true, message: 'Email đã được xác thực' };
    const token = await this.sendVerification(user.email, user.id);
    return { ok: true, token };
  }

  async verify(dto: VerifyEmailDto) {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      kind: string;
    }>(dto.token, {
      secret: this.configService.get('VERIFY_SECRET'),
    });
    if (payload.kind !== 'verify') throw new UnauthorizedException();
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    if (user.status === 'banned')
      throw new ForbiddenException('Tài khoản đã bị cấm');
    await this.usersService.verifyUser(user.id, user.status);
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      kind: string;
    }>(dto.token, {
      secret: this.configService.get('RESET_SECRET'),
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
    if (!valid) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    if (dto.newPassword === dto.currentPassword)
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    await this.usersService.clearRefreshToken(user.id);
    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { ok: true };
  }
}
