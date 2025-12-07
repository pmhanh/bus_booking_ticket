import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import type { Booking } from '../types/booking';
import { getBooking } from '../api/bookings';

export const BookingTicketPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { contact } = useBooking();
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>((location.state as { booking?: Booking })?.booking || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booking || !id) return;
    setLoading(true);
    getBooking(id, accessToken, { phone: contact.phone, email: contact.email })
      .then(setBooking)
      .catch((err) => setError(err.message || 'Không thể tải vé điện tử.'))
      .finally(() => setLoading(false));
  }, [accessToken, booking, contact.email, contact.phone, id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-gray-200 text-sm">Đang tải e-ticket...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <Card className="text-red-200 text-sm">{error}</Card>
        <Button variant="secondary" onClick={() => navigate('/bookings')}>
          Quản lý đặt chỗ
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  const { trip } = booking;
  const departure = new Date(trip.departureTime).toLocaleString();
  const arrival = new Date(trip.arrivalTime).toLocaleString();

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400">E-ticket</p>
          <h1 className="text-3xl font-bold text-white">Vé điện tử #{booking.referenceCode}</h1>
          <p className="text-sm text-gray-300">Hiển thị mã này khi lên xe hoặc tại quầy.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            In / Lưu PDF
          </Button>
          <Button onClick={() => navigate('/bookings')}>Quản lý đặt chỗ</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-emerald-900/60 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary grid place-items-center text-white font-bold text-lg">
              B1
            </div>
            <div>
              <div className="text-white font-semibold text-lg">BusTicket One</div>
              <div className="text-xs text-gray-400">Vé điện tử • Thanh toán online</div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-300">
            <div>Liên hệ: {booking.contactName}</div>
            <div>{booking.contactPhone}</div>
            <div>{booking.contactEmail || '—'}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-0">
          <div className="p-6 space-y-3 border-r border-white/10">
            <div className="flex items-center gap-3 text-white text-xl font-semibold">
              <span>{trip.route.originCity.name}</span>
              <span className="text-gray-500">{'→'}</span>
              <span>{trip.route.destinationCity.name}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-200">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
                <div className="text-white font-semibold">{departure}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs text-gray-400 uppercase">Giờ đến dự kiến</div>
                <div className="text-white font-semibold">{arrival}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs text-gray-400 uppercase">Xe</div>
                <div className="text-white font-semibold">{trip.bus.name}</div>
                <div className="text-xs text-gray-400">{trip.bus.plateNumber}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-xs text-gray-400 uppercase">Mã đặt chỗ</div>
                <div className="text-white font-semibold">{booking.referenceCode}</div>
                <div className="text-xs text-emerald-200">{booking.status}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase text-gray-400">Hành khách</div>
              <div className="space-y-2">
                {booking.passengers.map((p) => (
                  <div
                    key={p.seatCode}
                    className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-200/30 px-3 py-2 text-white"
                  >
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-xs text-gray-300">
                        Ghế {p.seatCode} · {p.phone || '—'} · {p.idNumber || '—'}
                      </div>
                    </div>
                    <div className="text-emerald-100 font-semibold">{p.price.toLocaleString()} đ</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-gradient-to-br from-emerald-900/60 to-slate-900/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="h-32 w-full rounded-xl bg-gradient-to-br from-white/10 to-white/5 grid place-items-center text-gray-200 text-sm border border-white/10">
                QR / Barcode
              </div>
              <div className="text-xs text-gray-400 mt-2">Quét tại quầy hoặc lên xe</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span>Tổng tiền</span>
                <span className="text-white font-semibold">{booking.totalPrice.toLocaleString()} đ</span>
              </div>
              <div className="text-xs text-emerald-200">
                Vé hợp lệ khi khớp thông tin liên hệ / mã đặt chỗ. Liên hệ hỗ trợ nếu cần chỉnh sửa.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
