import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import { RevenueChart } from '../components/RevenueChart';
import { TopRoutesChart } from '../components/TopRoutesChart';
import { BookingTrendsChart } from '../components/BookingTrendsChart';

type ReportsData = {
  generatedAt: string;
  range: { from: string; to: string };
  totals: {
    bookings: number;
    confirmedBookings: number;
    users: number;
    activeUsers: number;
    revenue: number;
    trips: {
      upcoming: number;
      cancelled: number;
    };
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
  }[];
  recentBookings: {
    id: string;
    route: string;
    pax: number;
    amount: number;
    status: string;
    createdAt: string;
  }[];
};

export const AdminReportsPage = () => {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [timeRange, setTimeRange] = useState<'7' | '14' | '30' | 'custom'>('7');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadReports = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (timeRange === 'custom') {
        if (fromDate) params.append('from', fromDate);
        if (toDate) params.append('to', toDate);
      } else {
        params.append('days', timeRange);
      }

      const response = await apiClient<ReportsData>(
        `/admin/reports/summary?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      setData(response);
    } catch (err) {
      setError((err as Error).message || 'Không thể tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  }, [accessToken, timeRange, fromDate, toDate]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const formatTrend = (value: number | null) => {
    if (value === null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Báo cáo & Phân tích</h1>
          <p className="text-sm text-gray-400">
            Theo dõi doanh thu, bookings và hiệu suất kinh doanh
          </p>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card title="Khoảng thời gian">
        <div className="flex flex-wrap gap-4 items-end">
          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Chọn khoảng</div>
            <select
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            >
              <option value="7">7 ngày gần nhất</option>
              <option value="14">14 ngày gần nhất</option>
              <option value="30">30 ngày gần nhất</option>
              <option value="custom">Tùy chỉnh</option>
            </select>
          </label>

          {timeRange === 'custom' && (
            <>
              <FormField
                label="Từ ngày"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <FormField
                label="Đến ngày"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </>
          )}

          <Button onClick={loadReports} disabled={loading}>
            {loading ? 'Đang tải...' : 'Làm mới'}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Tổng Bookings</div>
                <div className="text-2xl font-bold text-white">
                  {data.totals.bookings.toLocaleString('vi-VN')}
                </div>
                <div className="text-xs text-gray-400">
                  {data.totals.confirmedBookings.toLocaleString('vi-VN')} đã xác nhận
                </div>
                {data.trends.bookingsWoW !== null && (
                  <div
                    className={`text-xs ${
                      data.trends.bookingsWoW >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatTrend(data.trends.bookingsWoW)} WoW
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Tổng Doanh thu</div>
                <div className="text-2xl font-bold text-white">
                  {(data.totals.revenue / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-400">
                  Hôm nay: {data.today.revenue.toLocaleString('vi-VN')}đ
                </div>
                {data.trends.revenueWoW !== null && (
                  <div
                    className={`text-xs ${
                      data.trends.revenueWoW >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatTrend(data.trends.revenueWoW)} WoW
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Active Users</div>
                <div className="text-2xl font-bold text-white">
                  {data.totals.activeUsers.toLocaleString('vi-VN')}
                </div>
                <div className="text-xs text-gray-400">
                  / {data.totals.users.toLocaleString('vi-VN')} tổng
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Conversion Rate</div>
                <div className="text-2xl font-bold text-white">
                  {data.today.conversionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400">Hôm nay</div>
                <div
                  className={`text-xs ${
                    data.trends.conversionDoD >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {data.trends.conversionDoD >= 0 ? '+' : ''}
                  {data.trends.conversionDoD.toFixed(1)} pts DoD
                </div>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <Card title="Xu hướng Bookings & Doanh thu">
            <BookingTrendsChart
              bookingsData={data.daily.bookings}
              revenueData={data.daily.revenue}
            />
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="Doanh thu theo ngày">
              <RevenueChart data={data.daily.revenue} />
            </Card>

            <Card title="Top tuyến đường">
              <TopRoutesChart data={data.topRoutes} />
            </Card>
          </div>

          {/* Recent Bookings */}
          <Card title="Bookings gần đây">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-5 gap-3 text-xs uppercase text-gray-400 border-b border-white/5 pb-2 min-w-[600px]">
                <div>Mã booking</div>
                <div>Tuyến</div>
                <div>Hành khách</div>
                <div>Số tiền</div>
                <div>Trạng thái</div>
              </div>
              <div className="divide-y divide-white/5 text-sm text-gray-200 min-w-[600px]">
                {data.recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="grid grid-cols-5 gap-3 py-3 items-center"
                  >
                    <div className="font-mono text-primary">{booking.id}</div>
                    <div className="text-xs">{booking.route}</div>
                    <div>{booking.pax} người</div>
                    <div className="font-semibold text-white">
                      {booking.amount.toLocaleString('vi-VN')}đ
                    </div>
                    <div>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs ${
                          booking.status === 'CONFIRMED'
                            ? 'bg-green-600/30 text-green-300'
                            : booking.status === 'PENDING'
                              ? 'bg-yellow-600/30 text-yellow-300'
                              : 'bg-error/30 text-error'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
