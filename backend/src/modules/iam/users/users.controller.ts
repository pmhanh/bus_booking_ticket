import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageUploadOptions } from '../../../infrastructure/cloudinary/image-upload.options';
import type { Express } from 'express';
import { CurrentUser } from '../../../core/decorators/current-user.decorator';
import { Roles } from '../../../core/decorators/roles.decorator';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../core/interfaces/jwt-payload';
import { SetRoleDto } from './dto/set-role.dto';
import { SetStatusDto } from './dto/set-status.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('users/me')
  me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('users/me/profile')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/me/avatar')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions(3 * 1024 * 1024)))
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const updated = await this.usersService.uploadAvatar(user.sub, file);
    return { avatarUrl: updated.avatarUrl, user: updated };
  }

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin/users')
  list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ role, status, search });
  }

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/users/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.usersService.updateStatus(id, dto.status);
  }

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/users/:id/role')
  setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }
}
