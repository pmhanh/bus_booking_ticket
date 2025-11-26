import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('dashboard')
export class DashboardController {
  @UseGuards(JwtAuthGuard)
  @Get()
  getWidgets(@CurrentUser() user: JwtPayload) {
    return {
      user,
      summary: [
        { label: 'Tickets Sold', value: 482, trend: '+12%' },
        { label: 'Revenue', value: '$18.2k', trend: '+5%' },
        { label: 'On-time Rate', value: '93%', trend: '+2%' },
      ],
      activity: [
        { id: 1, message: 'New booking from Mai Nguyen', time: '5m ago' },
        { id: 2, message: 'Route HN - HCM delayed by 10m', time: '32m ago' },
        { id: 3, message: 'New partner bus added: Sunrise', time: '1h ago' },
      ],
      routes: [
        { route: 'Ha Noi → Da Nang', occupancy: 0.78 },
        { route: 'HCM → Can Tho', occupancy: 0.61 },
        { route: 'Da Nang → Hue', occupancy: 0.52 },
      ],
    };
  }

  @Roles('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('admin-metrics')
  adminMetrics() {
    return {
      auditsThisWeek: 12,
      suspendedUsers: 2,
      flaggedPayments: 1,
    };
  }
}
