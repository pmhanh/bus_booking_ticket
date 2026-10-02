import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { statusLabel } from '../../../shared/utils/displayLabels';
import { useAuth } from '../../auth/context/AuthContext';
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
    trips: { upcoming: number; cancelled: number };
  };
  today: {
    bookings: number;
    confirmedBookings: number;
    revenue: number;
    conversionRate: number;
  };
  thisWeek: { from: string; to: string; bookings: number; revenue: number };
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

const number = (value: number) => value.toLocaleString('vi-VN');
const currency = (value: number) => number(value) + ' ₫';
const date = (value: string) => new Date(value).toLocaleDateString('vi-VN');
const trend = (value: number | null, unit = '%') =>
  value === null
    ? 'Chưa có dữ liệu so sánh'
    : (value > 0 ? '+' : '') +
      value.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) +
      unit;

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <div className="text-sm text-gray-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white break-words">
        {value}
      </div>
      {detail && <div className="mt-2 text-xs text-gray-400">{detail}</div>}
    </Card>
  );
}

export const AdminReportsPage = () => {
  const { accessToken } = useAuth();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('7');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [query, setQuery] = useState('days=7');
  const [refresh, setRefresh] = useState(0);
  const rangeError =
    timeRange === 'custom'
      ? !fromDate || !toDate
        ? 'Vui lòng chọn đủ ngày bắt đầu và ngày kết thúc.'
        : fromDate > toDate
          ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
          : ''
      : '';

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    apiClient<ReportsData>('/admin/reports/summary?' + query, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) setData(response);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải dữ liệu tổng quan.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, query, refresh]);

  return (
    <div className="max-w-7xl mx-auto space-y-8" aria-busy={loading}>
      <header className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="text-center lg:col-start-2">
          <h1 className="text-2xl font-bold text-white text-center">Tổng quan & Báo cáo</h1>
          {data && (
            <p className="text-xs text-gray-400 mt-1">
              Cập nhật: {new Date(data.generatedAt).toLocaleString('vi-VN')}
            </p>
          )}
        </div>
        <Link
          to="/admin/trip-operations"
          className="justify-self-center text-primary hover:underline lg:justify-self-end"
        >
          Quản lý vận hành →
        </Link>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 p-4 text-red-300"
        >
          <p>{error}</p>
          {data && (
            <p className="text-sm mt-1">
              Đang hiển thị dữ liệu của lần tải thành công trước.
            </p>
          )}
          <Button
            variant="secondary"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            Thử lại
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-gray-400">
          Đang tải dữ liệu...
        </p>
      )}

      {data && (
        <section className="space-y-4" aria-labelledby="today-heading">
          <h2 id="today-heading" className="text-xl font-semibold text-white">
            Vận hành hôm nay
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Metric
              label="Đặt chỗ hôm nay"
              value={number(data.today.bookings)}
              detail={number(data.today.confirmedBookings) + ' đã xác nhận'}
            />
            <Metric
              label="Doanh thu hôm nay"
              value={currency(data.today.revenue)}
              detail={trend(data.trends.revenueDoD) + ' · So với hôm qua'}
            />
            <Metric
              label="Tỷ lệ xác nhận đặt chỗ hôm nay"
              value={number(data.today.conversionRate) + '%'}
              detail={
                trend(data.trends.conversionDoD, ' điểm %') +
                ' · So với hôm qua'
              }
            />
            <Metric
              label="Chuyến sắp khởi hành"
              value={number(data.totals.trips.upcoming)}
            />
          </div>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="analysis-heading">
        <h2 id="analysis-heading" className="text-xl font-semibold text-white">
          Phân tích theo thời gian
        </h2>
        <div className="w-fit max-w-full">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (rangeError) return;
              const params = new URLSearchParams(
                timeRange === 'custom'
                  ? { from: fromDate, to: toDate }
                  : { days: timeRange },
              );
              setQuery(params.toString());
              setRefresh((value) => value + 1);
            }}
          >
            <label className="block text-xs text-gray-200">
              <select
                className="h-9 w-40 rounded-lg bg-surface border border-white/10 px-2 py-1 text-sm"
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value)}
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
                  wrapperClassName="!mb-0 w-36 !text-xs [&>div]:!mb-1"
                  className="h-9 !px-2 !py-1 text-sm"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
                <FormField
                  label="Đến ngày"
                  wrapperClassName="!mb-0 w-36 !text-xs [&>div]:!mb-1"
                  className="h-9 !px-2 !py-1 text-sm"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </>
            )}
            <Button className="h-9 !px-3 !py-1 text-sm" type="submit" disabled={loading || !!rangeError}>
              {loading ? 'Đang tải...' : 'Áp dụng / Làm mới'}
            </Button>
          </form>
          {rangeError && (
            <p className="text-xs text-yellow-300 mt-2" role="status">
              {rangeError}
            </p>
          )}
        </div>
        {data && (
          <>
            <Card title="Xu hướng đặt chỗ và doanh thu">
              <BookingTrendsChart
                bookingsData={data.daily.bookings}
                revenueData={data.daily.revenue}
              />
              <p className="text-xs text-gray-400 mt-3">
                * Đặt chỗ tính theo ngày tạo đơn. Doanh thu tính theo ngày cập
                nhật thanh toán thành công của đơn đã xác nhận.
              </p>
            </Card>
            <Card title="Hiệu quả tuyến">
              <p className="text-xs text-gray-400 mb-4">
                3 tuyến có nhiều đơn đã xác nhận nhất, theo ngày khởi hành trong
                khoảng đã chọn.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm text-left">
                  <thead className="text-gray-400 border-b border-white/10">
                    <tr>
                      <th className="py-3">Tuyến</th>
                      <th>Đơn đã xác nhận</th>
                      <th>Doanh thu</th>
                      <th>Lấp đầy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {data.topRoutes.map((route) => (
                      <tr key={route.route}>
                        <td className="py-3 pr-3">{route.route}</td>
                        <td>{number(route.bookings)}</td>
                        <td>{currency(route.revenue)}</td>
                        <td>
                          {(route.load * 100).toLocaleString('vi-VN', {
                            maximumFractionDigits: 1,
                          })}
                          %
                        </td>
                      </tr>
                    ))}
                    {!data.topRoutes.length && (
                      <tr>
                        <td
                          colSpan={4}
                          className="py-6 text-center text-gray-400"
                        >
                          Chưa có dữ liệu tuyến trong khoảng đã chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>

      {data && (
        <>
          <Card
            title="Đặt chỗ gần đây"
            actions={
              <Link
                to="/admin/bookings"
                className="text-sm text-primary hover:underline"
              >
                Xem tất cả →
              </Link>
            }
          >
            <p className="text-xs text-gray-400 mb-4">
              8 đơn mới nhất trên toàn hệ thống, không theo bộ lọc ngày.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm text-left">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="py-3">Mã đặt chỗ</th>
                    <th>Tuyến</th>
                    <th>Hành khách</th>
                    <th>Số tiền</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.recentBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="py-3 pr-3 font-mono text-primary">
                        {booking.id}
                      </td>
                      <td className="pr-3">{booking.route}</td>
                      <td>{number(booking.pax)}</td>
                      <td className="pr-3 whitespace-nowrap">
                        {currency(booking.amount)}
                      </td>
                      <td>
                        <span
                          className={
                            'inline-flex px-2 py-1 rounded-full text-xs ' +
                            (booking.status === 'CONFIRMED'
                              ? 'bg-green-600/30 text-green-300'
                              : booking.status === 'PENDING'
                                ? 'bg-yellow-600/30 text-yellow-300'
                                : 'bg-white/10 text-gray-300')
                          }
                        >
                          {statusLabel(booking.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.recentBookings.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-gray-400"
                      >
                        Chưa có đặt chỗ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <section className="space-y-4" aria-labelledby="totals-heading">
            <h2
              id="totals-heading"
              className="text-xl font-semibold text-white"
            >
              Toàn hệ thống · Từ trước đến nay
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Metric
                label="Tổng lượt đặt chỗ"
                value={number(data.totals.bookings)}
                detail={number(data.totals.confirmedBookings) + ' đã xác nhận'}
              />
              <Metric
                label="Tổng doanh thu"
                value={currency(data.totals.revenue)}
                detail="Thanh toán thành công của các đơn đã xác nhận"
              />
              <Metric
                label="Tài khoản đang hoạt động"
                value={number(data.totals.activeUsers)}
                detail={
                  'Trong ' +
                  number(data.totals.users) +
                  ' tài khoản · Theo trạng thái tài khoản'
                }
              />
              <Metric
                label="Chuyến đã hủy"
                value={number(data.totals.trips.cancelled)}
                detail="Tất cả chuyến có trạng thái đã hủy"
              />
            </div>
          </section>
          <section className="space-y-4" aria-labelledby="week-heading">
            <h2 id="week-heading" className="text-xl font-semibold text-white">
              Tuần này · Từ {date(data.thisWeek.from)} đến{' '}
              {date(data.thisWeek.to)}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Metric
                label="Đặt chỗ tuần này"
                value={number(data.thisWeek.bookings)}
                detail={
                  trend(data.trends.bookingsWoW) + ' · So với cả tuần trước'
                }
              />
              <Metric
                label="Doanh thu tuần này"
                value={currency(data.thisWeek.revenue)}
                detail={
                  trend(data.trends.revenueWoW) + ' · So với cả tuần trước'
                }
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
};
