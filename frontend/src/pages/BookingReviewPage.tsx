import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';
import { createBooking } from '../api/bookings';
import { refreshSeatLock } from '../api/seats';

export const BookingReviewPage = () => {
  const navigate = useNavigate();
  const { trip, passengers, contact, totalPrice, clear, lockInfo } = useBooking();
  const { accessToken, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestSessionId] = useState(() => {
    const key = 'guest_session_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  });

  useEffect(() => {
    if (!trip || passengers.length === 0) {
      navigate('/search');
    }
  }, [trip, passengers.length, navigate]);

  const payload = useMemo(() => {
    if (!trip) return null;
    return {
      tripId: trip.id,
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      seats: passengers.map((p) => p.seatCode).filter(Boolean) as string[],
      passengers: passengers.map((p) => ({
        seatCode: p.seatCode,
        name: p.name,
        phone: p.phone,
        idNumber: p.idNumber,
      })),
      lockToken: lockInfo?.token,
      guestSessionId,
    };
  }, [contact.email, contact.name, contact.phone, passengers, trip, lockInfo?.token, guestSessionId]);

  const confirmBooking = async () => {
    if (!payload) return;
    if (!payload.lockToken) {
      setError('Vui long giu ghe truoc khi dat ve.');
      return;
    }
    if (!payload.contactPhone) {
      setError('Vui lòng nhập số điện thoại liên hệ');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await refreshSeatLock(
        payload.tripId,
        payload.lockToken,
        accessToken || undefined,
        Number((import.meta.env.VITE_SEAT_HOLD_MINUTES as string | undefined) || 10) || 10,
        payload.guestSessionId,
      );
      const booking = await createBooking(payload, accessToken);
      clear();
      navigate(`/bookings/${booking.id}/ticket`, { state: { booking } });
    } catch (err) {
      const message = (err as Error)?.message || 'Không thể tạo đặt chỗ.';
      if (message.toLowerCase().includes('lock')) {
        setError('Phiên giữ ghế hết hạn, vui lòng quay lại chọn ghế và giữ ghế lại.');
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip || !payload) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-gray-200 text-sm">Chưa có thông tin chuyến hoặc ghế được chọn.</Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400">Review booking</p>
          <h1 className="text-3xl font-bold text-white">Xác nhận đặt chỗ</h1>
          <p className="text-sm text-gray-300">
            Kiểm tra thông tin chuyến, hành khách và liên hệ trước khi thanh toán.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card title="Chuyến đi">
          <div className="flex flex-wrap items-center gap-2 text-white text-lg font-semibold">
            <span>{trip.route.originCity.name}</span>
            <span className="text-gray-500">{'->'}</span>
            <span>{trip.route.destinationCity.name}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-200 mt-3">
            <div>
              <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
              <div className="text-white font-semibold">{new Date(trip.departureTime).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Ghế đã chọn</div>
              <div className="text-white font-semibold">{passengers.map((p) => p.seatCode).join(', ')}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Xe</div>
              <div className="text-white font-semibold">{trip.bus.name}</div>
            </div>
          </div>
        </Card>

        <Card title="Liên hệ">
          <div className="text-sm text-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Người liên hệ</span>
              <span className="text-white font-semibold">{contact.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{contact.email || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Số điện thoại</span>
              <span className="text-white">{contact.phone}</span>
            </div>
            
          </div>
        </Card>
      </div>

      <Card title="Hành khách & thanh toán">
        <div className="space-y-3 text-sm text-gray-200">
          {passengers.map((p) => (
            <div
              key={p.seatCode}
              className="flex flex-col md:flex-row md:items-center justify-between border border-white/10 rounded-xl px-3 py-2"
            >
              <div className="space-y-1">
                <div className="text-white font-semibold">
                  Ghế {p.seatCode} · {p.name || 'Chưa nhập tên'}
                </div>
                <div className="text-xs text-gray-400">
                  SĐT: {p.phone || '—'} · ID: {p.idNumber || '—'}
                </div>
              </div>
              <div className="text-white font-semibold">{(p.price ?? trip.basePrice).toLocaleString()} đ</div>
            </div>
          ))}
          <div className="flex items-center justify-between text-lg text-white font-bold pt-2 border-t border-white/10">
            <span>Tổng thanh toán</span>
            <span>{totalPrice.toLocaleString()} đ</span>
          </div>
          <Button onClick={confirmBooking} disabled={submitting} className="w-full">
            {submitting ? 'Đang xử lý...' : 'Xác nhận & tạo e-ticket'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
