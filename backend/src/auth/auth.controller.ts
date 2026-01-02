import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
  Query,
  Res,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './interfaces/jwt-payload';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { UsersService } from '../users/users.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import type { Response, Request, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  private getRefreshCookieOptions(): CookieOptions {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      sameSite: isProduction ? 'none' : 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    };
  }

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(res, result.tokens.refreshToken);
    return { user: result.user, accessToken: result.tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.refresh_token as string | undefined;
    if (!token) return { accessToken: null };
    const result = await this.authService.refresh(token);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res() res: Response) {
    const cookieOptions = this.getRefreshCookieOptions();
    res.clearCookie('refresh_token', { ...cookieOptions, maxAge: 0 });
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

  @Get('google/start')
  googleStart(@Res() res: Response) {
    const url = this.authService.buildGoogleOAuthUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    const result = await this.authService.handleGoogleOAuthCode(code);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const payload = encodeURIComponent(
      JSON.stringify({ user: result.user, accessToken: result.tokens.accessToken }),
    );
    this.setRefreshCookie(res, result.tokens.refreshToken);
    const html = `<script>
      const data = JSON.parse(decodeURIComponent('${payload}'));
      if (window.opener) {
        window.opener.postMessage({source:'google-login', payload: data}, '*');
        // Let opener close the popup to avoid COOP warnings
        setTimeout(() => window.location.replace('${frontendUrl}'), 200);
      } else {
        window.location.replace('${frontendUrl}');
      }
    </script>Logged in. You can close this window.`;
    return res.send(html);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, this.getRefreshCookieOptions());
  }
}
