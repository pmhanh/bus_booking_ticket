import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { useEffect, useState } from 'react';
import { getBooking } from '../../booking/api/bookings';
import type { Booking } from '../../booking/types/booking';
import { BookingPaymentActions } from '../../booking/components/BookingPaymentActions';
import { readCheckoutReturn } from '../utils/checkoutReturn';
import { useAuth } from '../../auth/context/AuthContext';

type Props = { status: 'success' | 'cancel' };

function StripeResultPage({ status }: Props) {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const returnInfo = readCheckoutReturn(params.get('booking_id'));
  const bookingId = params.get('booking_id') || returnInfo?.bookingId;
  const email = returnInfo?.email;
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setBooking(null);
    setError('');
    const refresh = async () => {
      let retry = status === 'success';
      try {
        const data = await getBooking(bookingId, { email });
        if (!active) return;
        setBooking(data);
        setError('');
        retry = retry && data.status === 'PENDING';
      } catch {
        if (!active) return;
        setError(
          'Chưa tải được trạng thái mới nhất. Bạn có thể chọn Xem vé để kiểm tra đơn; không thanh toán lại nếu đã trả tiền.',
        );
      }
      if (active && retry) timer = setTimeout(() => void refresh(), 5000);
    };
    void refresh();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [bookingId, email, accessToken, status]);

  const isSuccess = status === 'success';
  const title =
    booking?.status === 'CONFIRMED'
      ? 'Đặt vé đã xác nhận'
      : booking?.status === 'CANCELLED'
        ? 'Đơn đặt chỗ đã hủy'
        : booking?.status === 'EXPIRED'
          ? 'Đơn đặt chỗ đã hết hạn'
          : isSuccess
            ? 'Đang kiểm tra thanh toán'
            : 'Bạn đã thoát thanh toán';
  const description =
    booking?.status === 'CONFIRMED'
      ? 'Đơn đã được xác nhận. Bạn có thể chọn Xem vé để xem mã QR và in vé.'
      : booking?.status === 'CANCELLED' || booking?.status === 'EXPIRED'
        ? 'Đơn không còn hiệu lực. Nếu đã trả tiền, hãy kiểm tra thông tin đơn hoặc liên hệ hỗ trợ trước khi đặt lại.'
        : isSuccess
          ? 'Hệ thống đang xác nhận kết quả thanh toán. Trang sẽ tự cập nhật, bạn không cần thanh toán lại.'
          : 'Thoát Stripe không tự hủy đơn. Nếu đơn còn hiệu lực và chưa thanh toán, bạn có thể tiếp tục hoặc hủy đơn bên dưới.';

  return (
    <div className="max-w-xl mx-auto mt-12 space-y-4">
      <Card>
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-gray-300 text-sm">{description}</p>
          {error ? <p className="text-sm text-amber-200">{error}</p> : null}
          {booking && !isSuccess ? (
            <BookingPaymentActions
              booking={booking}
              onUpdated={setBooking}
              showSecondaryActions={false}
            />
          ) : null}
          {sessionId ? (
            <p className="text-xs text-gray-400">
              Mã phiên thanh toán: {sessionId}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              to={booking ? `/bookings/${booking.id}/ticket` : '/bookings'}
              state={booking ? { booking } : undefined}
            >
              <Button variant="secondary">Xem vé</Button>
            </Link>
            <Link to="/search">
              <Button variant="secondary">Tiếp tục đặt vé</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export const StripeSuccessPage = () => <StripeResultPage status="success" />;
export const StripeCancelPage = () => <StripeResultPage status="cancel" />;
