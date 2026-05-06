import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({ role, status, search });
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.usersService.updateStatus(id, dto.status);
  }

  @Patch(':id/role')
  setRole(@Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }
}
