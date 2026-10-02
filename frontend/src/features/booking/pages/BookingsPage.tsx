import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { useAuth } from '../../auth/context/AuthContext';
import { useBooking } from '../context/BookingContext';
import type { Booking } from '../types/booking';
import {
  cancelBooking,
  getBooking,
  getMyBookings,
  lookupBooking,
} from '../api/bookings';
import { useToast } from '../../../shared/providers/ToastProvider';
import { useErrorNotification } from '../../../shared/providers/useErrorNotification';
import { BookingPaymentActions } from '../components/BookingPaymentActions';

const canCancelBefore3Hours = (departureTime?: string | Date | null) => {
  if (!departureTime) return false;
  const dep = new Date(departureTime).getTime();
  if (Number.isNaN(dep)) return false;
  return dep - Date.now() >= 3 * 60 * 60 * 1000;
};

export const BookingsPage = () => {
  const { user, accessToken } = useAuth();
  const { setContact } = useBooking();
  const { showMessage, confirm, showError } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupTripDate, setLookupTripDate] = useState('');
  const [lookupResults, setLookupResults] = useState<Booking[]>([]);
  const updateListedBooking = (updated: Booking) => {
    const replace = (items: Booking[]) =>
      items.map((item) => (item.id === updated.id ? updated : item));
    setBookings(replace);
    setLookupResults(replace);
  };
  const [lookupError, setLookupError] = useErrorNotification();
  const [lookupFieldError, setLookupFieldError] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getMyBookings()
      .then((data) => setBookings(data))
      .catch((err) =>
        showError(err.message || 'Không thể tải danh sách đặt chỗ'),
      )
      .finally(() => setLoading(false));
  }, [accessToken, showError]);

  const handleCancel = async (id: string) => {
    const booking =
      bookings.find((x) => x.id === id) ||
      lookupResults.find((result) => result.id === id);

    if (!booking) {
      showMessage({ type: 'error', message: 'Không tìm thấy đặt chỗ để hủy.' });
      return;
    }

    const departureTime = booking.trip?.departureTime;

    if (!canCancelBefore3Hours(departureTime)) {
      showMessage({
        type: 'error',
        message: 'Không thể hủy: phải hủy trước giờ khởi hành ít nhất 3 giờ.',
      });
      return;
    }

    const policy =
      'Vé đã thanh toán sẽ được hoàn toàn bộ khi hủy trước giờ khởi hành ít nhất 3 giờ.';

    const ok = await confirm({
      message: `Bạn có chắc muốn hủy đặt chỗ ${booking.reference || booking.id}?\n\n${policy}`,
      danger: true,
    });
    if (!ok) return;

    try {
      // guest cancel: nếu không có accessToken thì gửi contact để verify (backend của bạn có assertAccess)
      const contact = !accessToken
        ? {
            phone: booking.contactPhone || lookupPhone || undefined,
            email: booking.contactEmail || lookupEmail || undefined,
          }
        : undefined;

      const updated = await cancelBooking(id, contact);

      // Update list (ưu tiên data trả về từ backend nếu có)
      updateListedBooking(updated);

      showMessage({
        type: 'success',
        message: updated.refundPending
          ? 'Đã hủy vé. Yêu cầu hoàn tiền đã được lưu và đang chờ xử lý.'
          : `Đã hủy đặt chỗ ${booking.reference || booking.id}. ${policy}`,
      });
    } catch (e) {
      showMessage({
        type: 'error',
        message: (e as Error)?.message || 'Hủy đặt chỗ thất bại.',
      });
    }
  };

  const handleLookup = async () => {
    if (!lookupCode && !lookupPhone && !lookupEmail) {
      setLookupError('Nhập mã đặt chỗ hoặc thông tin liên hệ để tra cứu.');
      setLookupFieldError(true);
      return;
    }
    if (lookupCode && !lookupPhone && !lookupEmail) {
      setLookupError(
        'Tra cứu theo mã đặt chỗ cần email hoặc số điện thoại để xác thực.',
      );
      setLookupFieldError(true);
      return;
    }
    if (!lookupCode && (!lookupTripDate || (!lookupPhone && !lookupEmail))) {
      setLookupError(
        'Tra cứu không dùng mã cần ngày khởi hành và email hoặc số điện thoại.',
      );
      setLookupFieldError(true);
      return;
    }
    setLookupLoading(true);
    setLookupError(null);
    setLookupResults([]);
    setLookupFieldError(false);
    try {
      const results = lookupCode
        ? [
            await getBooking(lookupCode, {
              phone: lookupPhone || undefined,
              email: lookupEmail || undefined,
            }),
          ]
        : (
            await lookupBooking(
              lookupPhone || undefined,
              lookupEmail || undefined,
              lookupTripDate || undefined,
            )
          ).data;
      setLookupResults(results);
      const firstBooking = results[0];
      if (firstBooking) {
        setContact({
          phone: firstBooking.contactPhone,
          email: firstBooking.contactEmail || undefined,
        });
      }
    } catch (err) {
      setLookupError((err as Error)?.message || 'Không tìm thấy đặt chỗ');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Quản lý đặt chỗ</h1>
        </div>
        <Link to="/search">
          <Button variant="secondary">Đặt chuyến mới</Button>
        </Link>
      </div>

      {user ? (
        <Card title="Đặt chỗ của tôi">
          {loading ? (
            <div className="text-sm text-gray-300">Đang tải...</div>
          ) : null}

          {!loading && !bookings.length ? (
            <div className="text-sm text-gray-300">
              Chưa có đặt chỗ nào trong tài khoản.
            </div>
          ) : null}
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onCancel={handleCancel}
                onUpdated={updateListedBooking}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {!user ? (
        <Card title="Tra cứu đặt chỗ">
          <div className="grid md:grid-cols-4 gap-3">
            <FormField
              label="Mã đặt chỗ"
              value={lookupCode}
              onChange={(e) => {
                setLookupCode(e.target.value);
                if (lookupFieldError) setLookupFieldError(false);
                if (lookupError) setLookupError(null);
              }}
              error={
                lookupFieldError
                  ? 'Dùng mã thì phải nhập thêm email hoặc số điện thoại.'
                  : undefined
              }
            />
            <FormField
              label="Số điện thoại"
              value={lookupPhone}
              placeholder="Đăng nhập để xác thực"
              onChange={(e) => {
                setLookupPhone(e.target.value);
                if (lookupFieldError) setLookupFieldError(false);
                if (lookupError) setLookupError(null);
              }}
              error={
                lookupFieldError
                  ? 'Nhập thông tin liên hệ kèm mã đặt chỗ hoặc ngày khởi hành.'
                  : undefined
              }
            />
            <FormField
              label="Email"
              value={lookupEmail}
              placeholder="Tùy chọn"
              onChange={(e) => {
                setLookupEmail(e.target.value);
                if (lookupFieldError) setLookupFieldError(false);
                if (lookupError) setLookupError(null);
              }}
              error={
                lookupFieldError
                  ? 'Nhập thông tin liên hệ kèm mã đặt chỗ hoặc ngày khởi hành.'
                  : undefined
              }
            />
            <FormField
              label="Ngày khởi hành"
              type="date"
              value={lookupTripDate}
              onChange={(e) => {
                setLookupTripDate(e.target.value);
                if (lookupFieldError) setLookupFieldError(false);
                if (lookupError) setLookupError(null);
              }}
              error={
                lookupFieldError
                  ? 'Không dùng mã thì phải nhập ngày khởi hành.'
                  : undefined
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleLookup} disabled={lookupLoading}>
              {lookupLoading ? 'Đang tải...' : 'Tra cứu đặt chỗ'}
            </Button>
          </div>

          {lookupResults.length ? (
            <div className="mt-4 space-y-3">
              {lookupResults.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  onCancel={handleCancel}
                  onUpdated={updateListedBooking}
                />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
};

const BookingRow = ({
  booking,
  onCancel,
  onUpdated,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  onUpdated: (booking: Booking) => void;
}) => {
  const seatCodes = booking.passengers.map((p) => p.seatCode).filter(Boolean);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-white font-semibold">
          <span>{booking.trip?.route?.originCity?.name || 'Chưa có'}</span>
          <span className="text-gray-500">{'->'}</span>
          <span>{booking.trip?.route?.destinationCity?.name || 'Chưa có'}</span>
        </div>
        <div className="text-xs text-gray-400">
          {booking.trip?.departureTime
            ? new Date(booking.trip.departureTime).toLocaleString('vi-VN')
            : 'Chưa có giờ khởi hành'}{' '}
          - Ghế: {seatCodes.join(', ')}
        </div>
        <div className="text-xs text-emerald-200">
          Mã: {booking.reference || booking.id}
        </div>
      </div>
      <div className="space-y-2">
        <BookingPaymentActions booking={booking} onUpdated={onUpdated} />
        <div className="flex items-center gap-2">
          <Link
            to={`/bookings/${booking.id}/ticket`}
            state={{ booking: booking }}
          >
            <Button variant="secondary">
              {booking.status === 'CONFIRMED' ? 'Xem vé' : 'Xem đơn'}
            </Button>
          </Link>
          {booking.status === 'CONFIRMED' ? (
            <Button variant="ghost" onClick={() => onCancel(booking.id)}>
              Hủy vé
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
