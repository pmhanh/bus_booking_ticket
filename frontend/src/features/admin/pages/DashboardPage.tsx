import { useEffect, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { useAuth } from '../../auth/context/AuthContext';
import { apiClient } from '../../../shared/api/api';

type ApiReportsSummary = {
  generatedAt: string;
  range: { from: string; to: string };
  totals: {
    bookings: number;
    confirmedBookings: number;
    users: number;
    activeUsers: number;
    revenue: number;
    trips: { upcoming: number; cancelled: number };
  };
  today: {
    bookings: number;
    confirmedBookings: number;
    revenue: number;
    conversionRate: number;
  };
  thisWeek: {
    from: string;
    to: string;
    bookings: number;
    revenue: number;
  };
  trends: {
    bookingsWoW: number | null;
    revenueDoD: number | null;
    revenueWoW: number | null;
    conversionDoD: number;
  };
  daily: {
    bookings: { date: string; value: number }[];
    revenue: { date: string; value: number }[];
  };
  topRoutes: {
    route: string;
    bookings: number;
    revenue: number;
    load: number;
    onTime: number;
  }[];
  recentBookings: {
    id: string;
    route: string;
    pax: number;
    amount: number;
    status: string;
    createdAt: string;
  }[];
  dashboardSummary: { label: string; value: string; trend: string }[];
};

const formatCurrency = (amount: number) => {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}k`;
  }
  return amount.toString();
};

const formatBookingStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    CONFIRMED: 'Success',
    PENDING: 'Pending',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
};

const getDayLabel = (dateStr: string) => {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

export const DashboardPage = () => {
  const { user, accessToken } = useAuth();
  const [data, setData] = useState<ApiReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    setLoading(true);
    apiClient<ApiReportsSummary>('/admin/reports/summary', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (response) {
          setData(response);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch dashboard data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [accessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white">Không thể tải dữ liệu dashboard</div>
      </div>
    );
  }

  const maxTrendValue = data.daily.bookings.length > 0
    ? Math.max(...data.daily.bookings.map((p) => p.value))
    : 1;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">
            Xin chào {user?.fullName || user?.email || 'bạn'}, cùng theo dõi lộ trình khách và vận hành.
          </p>
        </div>
        <div className="flex gap-3">
          <Button>Tạo chuyến / Đặt vé</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {data.dashboardSummary.map((item) => (
          <Card key={item.label} className="relative overflow-hidden">
            <div className="text-lg font-semibold text-white mt-1">{item.label}</div>
            <div className="text-3xl font-bold text-white mt-2">{item.value}</div>
            <div className="text-sm text-success mt-1">{item.trend}</div>
            <div className="absolute right-2 bottom-2 h-16 w-16 rounded-full bg-primary/10 blur-2xl" />
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin / vận hành</h2>
          <p className="text-sm text-gray-400">
            KPI, xu hướng, cảnh báo rủi ro, nhiệm vụ phê duyệt.
          </p>
        </div>
        <Button variant="secondary">Thêm lịch / giá</Button>
      </div>

      {/* Bookings Trend & Top Routes */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Bookings trend (7 ngày)">
          <div className="flex items-end gap-3 h-48">
            {data.daily.bookings.map((point) => (
              <div key={point.date} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-primary to-secondary shadow-card"
                  style={{ height: `${(point.value / maxTrendValue) * 100}%` }}
                />
                <div className="text-xs text-gray-400">{getDayLabel(point.date)}</div>
                <div className="text-sm text-white font-semibold">{point.value}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top routes & load factor">
          <div className="space-y-3 text-sm text-gray-200">
            {data.topRoutes.map((route) => (
              <div key={route.route} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{route.route}</div>
                  <span className="text-xs text-gray-400">{formatCurrency(route.revenue)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                  <span>Bookings: {route.bookings}</span>
                  <span>Load: {Math.round(route.load * 100)}%</span>
                  <span>On-time: {Math.round(route.onTime * 100)}%</span>
                </div>
                <div className="h-2 mt-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-secondary to-primary"
                    style={{ width: `${route.load * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Bookings */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Recent bookings & thanh toán">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {data.recentBookings.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">{item.route}</div>
                    <div className="text-xs text-gray-400">
                      {item.id} • {item.pax} pax
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{formatCurrency(item.amount)}</div>
                    <div
                      className={`text-xs ${
                        item.status === 'CONFIRMED'
                          ? 'text-success'
                          : item.status === 'PENDING'
                            ? 'text-warning'
                            : 'text-secondary'
                      }`}
                    >
                      {formatBookingStatus(item.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-300">Tổng doanh thu</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(data.totals.revenue)}
              </div>
              <div className="text-sm text-gray-300 mt-4">Thống kê bookings</div>
              <div className="flex gap-2">
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Tổng: {data.totals.bookings}
                </span>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Confirmed: {data.totals.confirmedBookings}
                </span>
              </div>
              <div className="text-sm text-gray-300 mt-4">Chuyến đi</div>
              <div className="flex gap-2">
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Upcoming: {data.totals.trips.upcoming}
                </span>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Cancelled: {data.totals.trips.cancelled}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Thống kê hôm nay">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-400">Bookings hôm nay</div>
              <div className="text-2xl font-bold text-white">{data.today.bookings}</div>
              <div className="text-xs text-gray-400">Confirmed: {data.today.confirmedBookings}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Doanh thu hôm nay</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(data.today.revenue)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Conversion rate</div>
              <div className="text-2xl font-bold text-white">{data.today.conversionRate}%</div>
            </div>
            <div className="pt-4 border-t border-white/10">
              <div className="text-sm text-gray-400">Tuần này</div>
              <div className="text-lg font-semibold text-white">
                {data.thisWeek.bookings} bookings
              </div>
              <div className="text-sm text-gray-400">
                Doanh thu: {formatCurrency(data.thisWeek.revenue)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
