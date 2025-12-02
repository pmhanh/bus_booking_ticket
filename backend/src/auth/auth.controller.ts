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
import { GoogleLoginDto } from './dto/google-login.dto';
import { UpdateProfileDto } from '../users/dto/update-profile.dto';
import { UsersService } from '../users/users.service';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyRequestDto } from './dto/verify-request.dto';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  @HttpCode(200)
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string; userId: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
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
    const payload = encodeURIComponent(JSON.stringify(result));
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
}
