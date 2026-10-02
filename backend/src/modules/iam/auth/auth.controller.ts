import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import type { JwtPayload } from '../../../core/interfaces/jwt-payload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import type { Response, Request } from 'express';
import {
  GoogleAuthGuard,
  type GoogleOAuthRequest,
} from './guards/google-auth.guard';
import type { GoogleIdentity } from './google-auth.types';
import { AuthConfigService } from './auth-config.service';
import { AccountBannedException } from './account-banned.exception';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authConfig: AuthConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.tokens.refreshToken);
    return { user: result.user, accessToken: result.tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) throw new UnauthorizedException('No refresh token');
    const result = await this.authService.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (token) await this.authService.revokeRefreshToken(token);
    res.clearCookie('refresh_token', this.authConfig.refreshCookieOptions);
    return res.json({ message: 'Logged out' });
  }

  @Post('forgot')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset')
  reset(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-request')
  requestVerify(@Body() dto: VerifyRequestDto) {
    return this.authService.requestVerification(dto);
  }

  @Post('verify')
  verify(@Body() dto: VerifyEmailDto) {
    return this.authService.verify(dto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleLogin(@Req() req: GoogleOAuthRequest, @Res() res: Response) {
    try {
      const result = await this.authService.loginWithGoogle(
        req.user as GoogleIdentity,
      );
      this.setRefreshCookie(res, result.tokens.refreshToken);
      return res.redirect(
        this.authConfig.frontendRedirectUrl(req.oauthReturnTo),
      );
    } catch (error) {
      if (!(error instanceof AccountBannedException)) throw error;
      res.clearCookie('refresh_token', this.authConfig.refreshCookieOptions);
      return res.redirect(
        this.authConfig.frontendRedirectUrl('/account-banned'),
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, this.authConfig.refreshCookieOptions);
  }
}
