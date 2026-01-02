import { useEffect, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { useAuth } from '../../auth/context/AuthContext';
import { apiClient } from '../../../shared/api/api';

type TripStatus = 'upcoming' | 'past' | 'cancelled';

type Trip = {
  id: string;
  from: string;
  to: string;
  date: string; // ISO date string
  time: string; // HH:mm
  seats: string[];
  status: TripStatus;
  gate?: string;
  terminal?: string;
  delayNote?: string;
  vehicle?: string;
};

type AdminSummary = { label: string; value: string; trend: string };
type TrendPoint = { label: string; value: number };

type DashboardState = {
  trips: Trip[];
  admin: {
    summary: AdminSummary[];
    trend: TrendPoint[];
    routes: { route: string; bookings: number; revenue: string; load: number; onTime: number }[];
    recentBookings: { id: string; route: string; pax: number; amount: string; status: string }[];
    alerts: { title: string; detail: string; severity: 'warning' | 'info' | 'error'; time: string }[];
    tasks: { title: string; owner: string; due: string }[];
    health: { label: string; status: 'up' | 'degraded'; note: string }[];
  };
  perks: {
    loyaltyPoints: number;
    loyaltyTier: string;
    vouchers: string[];
    paymentMethods: string[];
    favorites: string[];
    passengers: string[];
    invoice: { company: string; taxCode: string; email: string };
  };
  notifications: { label: string; enabled: boolean }[];
};

type ApiDashboard = {
  summary?: { label: string; value: string | number; trend: string }[];
};

const MOCK_DASHBOARD: DashboardState = {
  trips: [
    {
      id: 'BK20251115001',
      from: 'HCM',
      to: 'Hanoi',
      date: '2025-11-15',
      time: '08:00',
      seats: ['A1', 'A2'],
      status: 'upcoming',
      gate: 'G12',
      terminal: 'T2',
      delayNote: '+10m boarding',
      vehicle: 'Sleeper #92',
    },
    {
      id: 'BK20251120031',
      from: 'Hanoi',
      to: 'Hue',
      date: '2025-11-20',
      time: '14:00',
      seats: ['B3'],
      status: 'upcoming',
      terminal: 'T1',
      vehicle: 'Limousine 18',
    },
    {
      id: 'BK20241012002',
      from: 'Danang',
      to: 'Hoi An',
      date: '2024-10-12',
      time: '10:15',
      seats: ['C4'],
      status: 'past',
      vehicle: 'Shuttle',
    },
    {
      id: 'BK20241009011',
      from: 'Hanoi',
      to: 'Sapa',
      date: '2024-10-09',
      time: '21:00',
      seats: ['D2', 'D3'],
      status: 'cancelled',
      delayNote: 'Refund in review',
    },
  ],
  perks: {
    loyaltyPoints: 1280,
    loyaltyTier: 'Bạc',
    vouchers: ['-10% cuối tuần', 'Giảm 20k hành lý', 'Ưu đãi hạng ghế premium'],
    paymentMethods: ['Visa ••8823 (Default)', 'Momo Wallet', 'Cash at station'],
    favorites: ['HCM → Hanoi', 'Hanoi → Hue', 'HCM → Dalat'],
    passengers: ['Nguyen An', 'Pham Linh', 'Tran Kien'],
    invoice: { company: 'ACME Travel', taxCode: '0102030405', email: 'billing@acme.vn' },
  },
  notifications: [
    { label: 'Nhắc nhở 24h trước giờ khởi hành', enabled: true },
    { label: 'Cập nhật chậm/đổi bến qua SMS', enabled: true },
    { label: 'Hoá đơn & e-ticket gửi email', enabled: true },
    { label: 'Push in-app cho gate change', enabled: false },
  ],
  admin: {
    summary: [
      { label: 'Tổng booking', value: '12,340', trend: '+6% WoW' },
      { label: 'Active users', value: '856', trend: '+3.1% vs hôm qua' },
      { label: 'Doanh thu hôm nay', value: '45.2M', trend: '+1.9% DoD' },
      { label: 'Conversion rate', value: '4.8%', trend: '+0.4 pts' },
    ],
    trend: [
      { label: 'Mon', value: 1200 },
      { label: 'Tue', value: 1350 },
      { label: 'Wed', value: 1430 },
      { label: 'Thu', value: 1280 },
      { label: 'Fri', value: 1660 },
      { label: 'Sat', value: 1740 },
      { label: 'Sun', value: 1510 },
    ],
    routes: [
      { route: 'HCM → Hanoi', bookings: 234, revenue: '8.2M', load: 0.92, onTime: 0.94 },
      { route: 'HCM → Dalat', bookings: 189, revenue: '3.4M', load: 0.85, onTime: 0.9 },
      { route: 'Hanoi → Hue', bookings: 122, revenue: '2.1M', load: 0.76, onTime: 0.88 },
    ],
    recentBookings: [
      { id: 'BK20251124012', route: 'HCM → Dalat', pax: 2, amount: '1.8M', status: 'Success' },
      { id: 'BK20251123004', route: 'Hanoi → Hue', pax: 1, amount: '650k', status: 'Refunding' },
      { id: 'BK20251122119', route: 'HCM → Hanoi', pax: 3, amount: '3.2M', status: 'Success' },
      { id: 'BK20251122002', route: 'Hanoi → Sapa', pax: 1, amount: '720k', status: 'Pending' },
    ],
    alerts: [
      { title: 'Delay HCM → Hanoi 08:00', detail: '+15m; notify 42 pax', severity: 'warning', time: '5m ago' },
      {
        title: 'Thanh toán thất bại tăng',
        detail: 'Gateway #2 có 3.2% lỗi trong 30 phút',
        severity: 'error',
        time: '12m ago',
      },
      {
        title: 'Rủi ro trùng thẻ',
        detail: '5 attempt thất bại cùng thẻ ••4411',
        severity: 'info',
        time: '30m ago',
      },
    ],
    tasks: [
      { title: 'Duyệt hoàn vé BK20241009011', owner: 'Ops', due: 'Today' },
      { title: 'Phê duyệt đổi giờ - BK20251120031', owner: 'Support', due: '2h' },
      { title: 'Xuất CSV doanh thu tuần', owner: 'Finance', due: 'EOD' },
    ],
    health: [
      { label: 'Payment gateway', status: 'up', note: 'Latency 220ms' },
      { label: 'Webhooks', status: 'up', note: 'All 37 deliveries ok' },
      { label: 'Notification SMS', status: 'degraded', note: 'Vendor quota 80%' },
    ],
  },
};

export const DashboardPage = () => {
  const { user, accessToken } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardState>(MOCK_DASHBOARD);

  useEffect(() => {
    if (!accessToken) return;
    apiClient<ApiDashboard>('/dashboard', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((remote) => {
        if (!remote?.summary?.length) return;
        setDashboard((prev) => ({
          ...prev,
          admin: {
            ...prev.admin,
            summary: remote.summary!.map((item) => ({
              label: item.label,
              value: String(item.value),
              trend: item.trend,
            })),
          },
        }));
      })
      .catch(() => undefined);
  }, [accessToken]);

  const maxTrendValue =
    dashboard.admin.trend.length > 0
      ? Math.max(...dashboard.admin.trend.map((p) => p.value))
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
          {/* <Button variant="secondary">Xuất CSV</Button> */}
          <Button>Tạo chuyến / Đặt vé</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {dashboard.admin.summary.map((item) => (
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

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Bookings trend (7 ngày)">
          <div className="flex items-end gap-3 h-48">
            {dashboard.admin.trend.map((point) => (
              <div key={point.label} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-xl bg-gradient-to-t from-primary to-secondary shadow-card"
                  style={{ height: `${(point.value / maxTrendValue) * 100}%` }}
                />
                <div className="text-xs text-gray-400">{point.label}</div>
                <div className="text-sm text-white font-semibold">{point.value}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Top routes & load factor">
          <div className="space-y-3 text-sm text-gray-200">
            {dashboard.admin.routes.map((route) => (
              <div key={route.route} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{route.route}</div>
                  <span className="text-xs text-gray-400">{route.revenue}</span>
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

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Recent bookings & thanh toán">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              {dashboard.admin.recentBookings.map((item) => (
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
                    <div className="text-white font-semibold">{item.amount}</div>
                    <div
                      className={`text-xs ${
                        item.status === 'Success'
                          ? 'text-success'
                          : item.status === 'Pending'
                            ? 'text-warning'
                            : 'text-secondary'
                      }`}
                    >
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-sm text-gray-300">Tỷ lệ thành công cổng thanh toán</div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-success" style={{ width: '94%' }} />
              </div>
              <div className="text-sm text-gray-300">Hoàn / đổi vé trong hàng chờ</div>
              <div className="flex gap-2">
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Refund queue: 7
                </span>
                <span className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
                  Change queue: 3
                </span>
              </div>
              <div className="text-xs text-gray-400">
                Cảnh báo fraud: theo dõi duplicate cards, abnormal attempts.
              </div>
            </div>
          </div>
        </Card>
        <Card title="Alerts & nhiệm vụ">
          <div className="space-y-3">
            {dashboard.admin.alerts.map((alert) => (
              <div
                key={alert.title}
                className={`p-3 rounded-xl border ${
                  alert.severity === 'error'
                    ? 'border-error/40 bg-error/10 text-error'
                    : alert.severity === 'warning'
                      ? 'border-warning/40 bg-warning/10 text-warning'
                      : 'border-secondary/40 bg-secondary/10 text-secondary'
                }`}
              >
                <div className="font-semibold">{alert.title}</div>
                <div className="text-sm text-white/80">{alert.detail}</div>
                <div className="text-xs text-white/60 mt-1">{alert.time}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.admin.tasks.map((task) => (
              <div key={task.title} className="flex items-center justify-between text-sm text-gray-200">
                <div>
                  <div className="font-semibold text-white">{task.title}</div>
                  <div className="text-xs text-gray-400">
                    Owner: {task.owner} • Due: {task.due}
                  </div>
                </div>
                <Button variant="secondary" className="px-3 py-1 text-xs">
                  Mở
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      
    </div>
  );
};
