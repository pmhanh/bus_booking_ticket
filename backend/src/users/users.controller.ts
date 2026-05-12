import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum } from 'class-validator';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Express } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { UserStatus, UserRole } from './user.entity';

class SetStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

class SetRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 3 * 1024 * 1024 })],
      }),
    )
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const relativePath = `/uploads/avatars/${file.filename}`;
    const updated = await this.usersService.updateProfile(user.sub, {
      avatarUrl: relativePath,
    });
    return { avatarUrl: relativePath, user: updated };
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
