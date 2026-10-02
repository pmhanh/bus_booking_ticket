import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../../core/interfaces/jwt-payload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import { MailService } from '../../../infrastructure/mail/mail.service';
import { AuthProvider, UserStatus } from '../users/user.entity';
import { RefreshSessionService } from './refresh-session.service';
import { GoogleIdentity } from './google-auth.types';
import { AccountBannedException } from './account-banned.exception';
import { AuthConfigService } from './auth-config.service';

type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly refreshSessions: RefreshSessionService,
    private readonly authConfig: AuthConfigService,
  ) {}

  private async signTokens(payload: JwtPayload): Promise<Tokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.authConfig.accessTokenExpiresIn,
    });
    const refreshToken = await this.refreshSessions.create(payload.sub);
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
    if (user.status === UserStatus.BANNED)
      throw new AccountBannedException();
    if (user.status === UserStatus.PENDING || !user.verified)
      throw new ForbiddenException(
        'Vui lòng xác thực email trước khi đăng nhập.',
      );
    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk)
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser, tokens };
  }

  async loginWithGoogle(identity: GoogleIdentity) {
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    const user = await this.usersService.createFromProvider(identity.email, {
      fullName: identity.fullName,
      avatarUrl: identity.avatarUrl,
      provider: AuthProvider.GOOGLE,
      verified: true,
    });

    if (user.status === UserStatus.BANNED) {
      throw new AccountBannedException();
    }

    const tokens = await this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { user, tokens };
  }

  async refresh(refreshToken: string) {
    const session = await this.refreshSessions.consume(refreshToken);
    if (!session) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || user.status === UserStatus.BANNED) {
      if (user) await this.refreshSessions.revokeAllForUser(user.id);
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    return this.signTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  revokeRefreshToken(refreshToken: string) {
    return this.refreshSessions.revoke(refreshToken);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user)
      return {
        ok: true,
        message: 'Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.',
      };
    const token = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, kind: 'reset' },
      {
        expiresIn: '1h',
        secret: this.authConfig.resetSecret,
      },
    );
    const resetLink = `${this.authConfig.frontendUrl}/reset?token=${token}`;

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
      errorLabel: 'reset email',
    });
    return {
      ok: true,
      message: 'Email đặt lại mật khẩu đã được gửi nếu tài khoản tồn tại.',
    };
  }

  private async sendVerification(email: string, userId: string) {
    const token = await this.jwtService.signAsync(
      { sub: userId, email, kind: 'verify' },
      {
        expiresIn: '1h',
        secret: this.authConfig.verifySecret,
      },
    );
    const verifyLink = `${this.authConfig.frontendUrl}/verify?token=${token}`;

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
      errorLabel: 'verification email',
    });
  }

  async requestVerification(dto: VerifyRequestDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Không tìm thấy người dùng');
    if (user.verified) return { ok: true, message: 'Email đã được xác thực' };
    await this.sendVerification(user.email, user.id);
    return { ok: true, message: 'Email xác thực đã được gửi.' };
  }

  async verify(dto: VerifyEmailDto) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        kind: string;
      }>(dto.token, {
        secret: this.authConfig.verifySecret,
      });
      if (payload.kind !== 'verify') throw new UnauthorizedException();
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      if (user.status === UserStatus.BANNED)
        throw new ForbiddenException('Tài khoản đã bị cấm');
      await this.usersService.verifyUser(user.id, user.status);
      return { ok: true };
    } catch (err) {
      if (
        err instanceof ForbiddenException ||
        err instanceof UnauthorizedException
      )
        throw err;
      throw new UnauthorizedException(
        'Token xác thực không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        kind: string;
      }>(dto.token, {
        secret: this.authConfig.resetSecret,
       });
      if (payload.kind !== 'reset') throw new UnauthorizedException();
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      await this.refreshSessions.revokeAllForUser(user.id);
      await this.usersService.updatePassword(user.id, dto.newPassword);
      return { ok: true };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.provider !== AuthProvider.LOCAL) {
      throw new BadRequestException('Tài khoản không hỗ trợ đổi mật khẩu.');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Mật khẩu hiện tại không đúng');

    if (dto.newPassword === dto.currentPassword)
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');

    await this.refreshSessions.revokeAllForUser(user.id);
    await this.usersService.updatePassword(user.id, dto.newPassword);
    return { ok: true };
  }
}
