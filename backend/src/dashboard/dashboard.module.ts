import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  controllers: [DashboardController],
  providers: [RolesGuard],
})
export class DashboardModule {}
