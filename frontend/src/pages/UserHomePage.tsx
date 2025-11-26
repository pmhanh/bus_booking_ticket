import { useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

type TripStatus = 'upcoming' | 'past' | 'cancelled';

type Trip = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: string[];
  status: TripStatus;
};

type Perks = {
  loyaltyPoints: number;
  vouchers: string[];
  paymentMethods: string[];
  favorites: string[];
  passengers: string[];
};

type NotificationPref = { label: string; enabled: boolean };

const MOCK_TRIPS: Trip[] = [
  { id: 'BK20251115001', from: 'HCM', to: 'Hanoi', date: '2025-11-15', time: '08:00', seats: ['A1', 'A2'], status: 'upcoming' },
  { id: 'BK20251120031', from: 'Hanoi', to: 'Hue', date: '2025-11-20', time: '14:00', seats: ['B3'], status: 'upcoming' },
  { id: 'BK20241012002', from: 'Danang', to: 'Hoi An', date: '2024-10-12', time: '10:15', seats: ['C4'], status: 'past' },
  { id: 'BK20241009011', from: 'Hanoi', to: 'Sapa', date: '2024-10-09', time: '21:00', seats: ['D2', 'D3'], status: 'cancelled' },
];

const MOCK_PERKS: Perks = {
  loyaltyPoints: 1280,
  vouchers: ['-10% cuối tuần', 'Giảm 20k hành lý', 'Ưu đãi hạng premium'],
  paymentMethods: ['Visa ••8823 (Default)', 'Momo Wallet'],
  favorites: ['HCM → Hanoi', 'Hanoi → Hue', 'HCM → Dalat'],
  passengers: ['Nguyen An', 'Pham Linh', 'Tran Kien'],
};

const MOCK_NOTIFICATIONS: NotificationPref[] = [
  { label: 'Nhắc nhở 24h trước giờ khởi hành', enabled: true },
  { label: 'Cập nhật trễ / đổi bến qua SMS', enabled: true },
  { label: 'Gửi e-ticket & invoice qua email', enabled: true },
  { label: 'Push in-app cho gate change', enabled: false },
];

export const UserHomePage = () => {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<TripStatus>('upcoming');
  const [search, setSearch] = useState('');

  const trips = useMemo(() => {
    const normalized = search.toLowerCase().trim();
    return MOCK_TRIPS.filter((t) => t.status === statusFilter).filter((t) =>
      normalized ? `${t.from} ${t.to} ${t.id}`.toLowerCase().includes(normalized) : true,
    );
  }, [statusFilter, search]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 to-secondary/10 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-200">Xin chào {user?.fullName || user?.email || 'bạn'}</p>
            <h1 className="text-3xl font-bold text-white">Quản lý chuyến & vé của bạn</h1>
            <p className="text-sm text-gray-200">Tra cứu chuyến sắp tới, e-ticket, ưu đãi và hỗ trợ.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Hỗ trợ nhanh</Button>
            <Button>Tìm chuyến mới</Button>
          </div>
        </div>
        <div className="mt-4 grid md:grid-cols-[2fr_1fr] gap-3">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-gray-300 focus:outline-none focus:border-secondary"
              placeholder="Tìm booking ID, điểm đi/đến"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:border-secondary">
              <option>30 ngày tới</option>
              <option>7 ngày tới</option>
              <option>Quý này</option>
            </select>
          </div>
          <div className="flex gap-2">
            {(['upcoming', 'past', 'cancelled'] as TripStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 px-3 py-2 rounded-xl border text-sm transition-colors ${
                  statusFilter === s ? 'bg-secondary text-surface border-secondary' : 'border-white/15 text-white'
                }`}
              >
                {s === 'upcoming' ? 'Sắp diễn ra' : s === 'past' ? 'Đã đi' : 'Đã huỷ'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Chuyến của bạn" actions={<span className="text-xs text-gray-400">Sort: soonest</span>}>
          <div className="space-y-3">
            {trips.length ? (
              trips.map((trip) => (
                <div key={trip.id} className="rounded-xl border border-white/10 bg-white/5 p-4 grid md:grid-cols-[1fr_auto] gap-3">
                  <div>
                    <div className="text-lg font-semibold text-white">
                      {trip.from} → {trip.to}
                    </div>
                    <div className="text-sm text-gray-300 mt-1">
                      {trip.date} • {trip.time} • Ghế: {trip.seats.join(', ')}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Booking ID: {trip.id}</div>
                  </div>
                  <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2 items-stretch md:items-end">
                    <Button variant="secondary" className="flex-1">
                      Đổi ghế / giờ
                    </Button>
                    <Button variant="secondary" className="flex-1">
                      Thêm hành lý
                    </Button>
                    <Button className="flex-1">Xem e-ticket</Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-8">Không có chuyến trong bộ lọc này</div>
            )}
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Thông báo & nhắc nhở">
            <div className="space-y-2">
              {MOCK_NOTIFICATIONS.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-200">{item.label}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.enabled ? 'bg-success/20 text-success' : 'bg-white/10 text-gray-400'
                    }`}
                  >
                    {item.enabled ? 'Bật' : 'Tắt'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-300">FAQ • Chat • Gửi yêu cầu có mã booking</div>
          </Card>
          <Card title="Hỗ trợ & trạng thái">
            <div className="space-y-2 text-sm text-gray-200">
              <div className="flex items-center justify-between">
                <span>Live delay & gate change</span>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10">Realtime</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Hoàn vé / đổi vé</span>
                <Button variant="secondary" className="px-3 py-1 text-xs">
                  Gửi yêu cầu
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span>Tải invoice / e-ticket</span>
                <Button variant="secondary" className="px-3 py-1 text-xs">
                  Tải
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Ưu đãi & thanh toán">
          <div className="text-sm text-gray-200 space-y-2">
            <div className="flex items-center justify-between">
              <span>Điểm tích luỹ</span>
              <span className="font-semibold text-white">{MOCK_PERKS.loyaltyPoints} pts</span>
            </div>
            <div>
              <div className="text-xs text-gray-400">Vouchers</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {MOCK_PERKS.vouchers.map((v) => (
                  <span key={v} className="px-2 py-1 rounded-full bg-white/10 text-xs text-white">
                    {v}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Phương thức lưu</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {MOCK_PERKS.paymentMethods.map((m) => (
                  <span key={m} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-200">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Hồ sơ & tuyến ưa thích">
          <div className="text-sm text-gray-200 space-y-2">
            <div>
              <div className="text-xs text-gray-400">Hành khách lưu</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {MOCK_PERKS.passengers.map((p) => (
                  <span key={p} className="px-2 py-1 rounded-full bg-white/10 text-xs text-white">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Tuyến ưa thích</div>
              <div className="space-y-1 mt-1">
                {MOCK_PERKS.favorites.map((r) => (
                  <div key={r} className="flex items-center gap-2 text-white">
                    <span className="h-2 w-2 rounded-full bg-secondary" />
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card title="Tác vụ nhanh">
          <div className="space-y-2 text-sm text-gray-200">
            <div className="flex items-center justify-between">
              <span>Đổi chỗ / thêm hành khách</span>
              <Button variant="secondary" className="px-3 py-1 text-xs">
                Mở
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span>Lưu e-ticket vào ví</span>
              <Button variant="secondary" className="px-3 py-1 text-xs">
                Lưu
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span>Gửi lại thông báo</span>
              <Button variant="secondary" className="px-3 py-1 text-xs">
                Gửi
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
