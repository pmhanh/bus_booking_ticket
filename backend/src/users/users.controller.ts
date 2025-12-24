import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserStatus } from './user.entity';

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
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: UserStatus },
  ) {
    return this.usersService.updateStatus(id, body.status);
  }
}
