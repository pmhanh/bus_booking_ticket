import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { CloudinaryModule } from '../../../infrastructure/cloudinary/cloudinary.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CloudinaryModule],
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
