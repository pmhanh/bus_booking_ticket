import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [DashboardController],
  providers: [RolesGuard],
})
export class DashboardModule {}
