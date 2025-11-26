import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
