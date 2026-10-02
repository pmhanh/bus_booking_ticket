import { useErrorNotification } from '../../../shared/providers/useErrorNotification';
import { statusLabel } from '../../../shared/utils/displayLabels';
import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { BackNavigationLayout } from '../../../shared/components/ui/BackNavigationLayout';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../../auth/context/AuthContext';
import type { Booking } from '../types/booking';
import { getBooking } from '../api/bookings';
import { getBookingPassengers } from '../utils/bookingPassengers';
import { BookingPaymentActions } from '../components/BookingPaymentActions';
import './BookingTicketPage.css';

export const BookingTicketPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { contact } = useBooking();
  const { accessToken } = useAuth();

  const stateBooking = (location.state as { booking?: Booking } | null)
    ?.booking;
  const matchingBooking =
    stateBooking?.id === id || stateBooking?.reference === id
      ? stateBooking
      : null;
  const email = matchingBooking?.contactEmail || contact.email;
  const phone = matchingBooking?.contactPhone || contact.phone;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useErrorNotification();

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setBooking(null);
    setError(null);
    let fetching = false;
    const refresh = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await getBooking(id, { phone, email });
        if (active) {
          setBooking(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setBooking(null);
          setError(
            (err as Error).message || 'Không thể xác minh trạng thái vé.',
          );
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [accessToken, email, phone, id, refreshKey, setError]);

  const printTicket = async () => {
    if (!id || printing) return;
    setPrinting(true);
    try {
      const latest = await getBooking(id, { email, phone });
      flushSync(() => setBooking(latest));
      if (latest.status === 'CONFIRMED') window.print();
    } catch (err) {
      setBooking(null);
      setError((err as Error).message || 'Không thể xác minh vé để in.');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-gray-200 text-sm">Đang tải vé điện tử...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <Card className="text-red-200 text-sm">{error}</Card>
        <Button onClick={() => setRefreshKey((value) => value + 1)}>
          Thử lại
        </Button>
        <Button variant="secondary" onClick={() => navigate('/bookings')}>
          Quản lý đặt chỗ
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <BookingTicketView
      booking={booking}
      printing={printing}
      onPrint={() => void printTicket()}
      onBack={() => navigate(-1)}
      paymentActions={
        <BookingPaymentActions booking={booking} onUpdated={setBooking} />
      }
    />
  );
};

export const BookingTicketView = ({
  booking,
  printing,
  onPrint,
  onBack,
  paymentActions,
}: {
  booking: Booking;
  printing: boolean;
  onPrint: () => void;
  onBack: () => void;
  paymentActions?: ReactNode;
}) => {
  const { trip } = booking;
  const isConfirmed = booking.status === 'CONFIRMED';
  const title = isConfirmed ? 'Vé điện tử' : 'Thông tin đặt chỗ';
  const statusMessage =
    booking.status === 'PENDING'
      ? 'Đơn đang chờ xác nhận thanh toán. Mã đặt chỗ chỉ dùng để tra cứu, chưa phải vé lên xe.'
      : booking.status === 'CANCELLED'
        ? 'Đơn đã bị hủy, không có vé hợp lệ để lên xe.'
        : 'Đơn chưa được thanh toán.';
  const passengers = getBookingPassengers(booking);
  const departure = trip?.departureTime
    ? new Date(trip.departureTime).toLocaleString('vi-VN')
    : '';
  const arrival = trip?.arrivalTime
    ? new Date(trip.arrivalTime).toLocaleString('vi-VN')
    : '';

  return (
    <BackNavigationLayout onBack={onBack} contentClassName="booking-ticket-page max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase text-gray-400">{title}</p>
            <h1 className="text-3xl font-bold text-white">
              {title} #{booking.reference || booking.id}
            </h1>
            <p className="text-sm text-gray-300">
              {isConfirmed
                ? 'Đưa mã này khi lên xe hoặc tại quầy.'
                : 'Mã đặt chỗ dùng để tra cứu trạng thái đơn.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          {isConfirmed ? (
            <Button disabled={printing} onClick={onPrint}>
              {printing ? 'Đang kiểm tra vé...' : 'In / Lưu PDF'}
            </Button>
          ) : null}
        </div>
      </div>

      {paymentActions}
      <div className="booking-ticket overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-emerald-900/60 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary grid place-items-center text-white font-bold text-lg">
              B1
            </div>
            <div>
              <div className="text-white font-semibold text-lg">
                BusTicket One
              </div>
              <div className="text-xs text-gray-400">
                {title} • Thanh toán trực tuyến
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-300">
            <div>Liên hệ: {booking.contactName}</div>
            <div>{booking.contactPhone}</div>
            <div>{booking.contactEmail || ''}</div>
          </div>
        </div>

        <div className="booking-ticket-columns grid md:grid-cols-[1.1fr_0.9fr] gap-0">
          <div className="p-6 space-y-3 border-r border-white/10">
            <div className="flex items-center gap-3 text-white text-xl font-semibold">
              <span>{trip?.route?.originCity?.name || 'N/A'}</span>
              <span className="text-gray-500">{'->'}</span>
              <span>{trip?.route?.destinationCity?.name || 'N/A'}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-200">
              <InfoBox label="Giờ đi" value={departure || 'Chưa có'} />
              <InfoBox label="Giờ đến dự kiến" value={arrival || 'Chưa có'} />
              <InfoBox
                label="Xe"
                value={trip?.bus?.name || 'Chưa có'}
                sub={trip?.bus?.plateNumber}
              />
              <InfoBox
                label="Mã đặt chỗ"
                value={String(booking.reference || booking.id)}
                sub={statusLabel(booking.status)}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase text-gray-400">Hành khách</div>

              <div className="space-y-2">
                {passengers.length === 0 ? (
                  <div className="text-gray-400 text-sm">
                    Không có dữ liệu hành khách.
                  </div>
                ) : (
                  passengers.map((p) => {
                    const seatCode = p.seatCode;
                    const name = p.name;
                    const phone = p.phone ?? '';
                    const idNumber = p.idNumber ?? '';
                    const price = p.price ?? trip?.basePrice ?? 0;

                    return (
                      <div
                        key={String(seatCode) + String(name)}
                        className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-200/30 px-3 py-2 text-white"
                      >
                        <div>
                          <div className="font-semibold">{name}</div>
                          <div className="text-xs text-gray-300">
                            Ghế {seatCode} · {phone} · {idNumber}
                          </div>
                        </div>
                        <div className="text-emerald-100 font-semibold">
                          {Number(price).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-gradient-to-br from-emerald-900/60 to-slate-900/80">
            {isConfirmed ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center space-y-2">
                <div className="w-full grid place-items-center">
                  <QRCodeSVG
                    value={booking.reference || booking.id}
                    size={180}
                  />
                </div>
                <div className="text-sm text-white font-semibold break-all">
                  {booking.reference || booking.id}
                </div>
                <div className="text-xs text-gray-400">
                  Quét tại quầy hoặc lên xe
                </div>
              </div>
            ) : (
              <div
                role="status"
                className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-sm text-amber-100"
              >
                <p className="mb-2 font-semibold">
                  {statusLabel(booking.status)}
                </p>
                <p>{statusMessage}</p>
              </div>
            )}

            {isConfirmed ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span>Tổng tiền</span>
                  <span className="text-white font-semibold">
                    {(booking.totalPrice ?? 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <div className="text-xs text-emerald-200">
                  Vé hợp lệ khi khớp thông tin liên hệ / mã đặt chỗ. Liên hệ hỗ
                  trợ nếu cần chỉnh sửa.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </BackNavigationLayout>
  );
};

const InfoBox = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) => (
  <div className="rounded-xl bg-white/5 text-gray-100 border border-white/10 p-3">
    <div className="text-[11px] uppercase text-gray-400">{label}</div>
    <div className="text-base font-semibold text-white">{value}</div>
    {sub ? <div className="text-xs text-emerald-200">{sub}</div> : null}
  </div>
);
