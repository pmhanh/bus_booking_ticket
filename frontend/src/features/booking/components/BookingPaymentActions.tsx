import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { useToast } from '../../../shared/providers/ToastProvider';
import { createStripePayment } from '../../payments/api/payments';
import { cancelBooking, getBooking } from '../api/bookings';
import type { Booking } from '../types/booking';

export const BookingPaymentActions = ({
  booking,
  onUpdated,
  showSecondaryActions = true,
}: {
  booking: Booking;
  onUpdated: (booking: Booking) => void;
  showSecondaryActions?: boolean;
}) => {
  const { confirm, showError, showSuccess, showMessage } = useToast();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const deadline = booking.checkoutExpiresAt || booking.expiresAt;
  const remaining = deadline
    ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000))
    : 0;
  const expired =
    booking.status === 'EXPIRED' ||
    (booking.status === 'PENDING' && !!deadline && remaining <= 0);

  useEffect(() => {
    if (booking.status !== 'PENDING') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [booking.status]);

  const act = async (action: 'pay' | 'cancel') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const contact = {
      email: booking.contactEmail || undefined,
      phone: booking.contactPhone,
    };
    try {
      if (
        action === 'cancel' &&
        !(await confirm({
          title: 'Hủy đơn chưa thanh toán',
          message: 'Bạn có muốn hủy đơn này và nhả các ghế đang giữ?',
          confirmText: 'Hủy đơn',
          cancelText: 'Giữ đơn',
          danger: true,
        }))
      )
        return;
      const current = await getBooking(booking.id, contact);
      onUpdated(current);
      if (current.status !== 'PENDING') {
        showMessage({
          type: 'info',
          message:
            current.status === 'CONFIRMED'
              ? 'Đơn đã xác nhận. Bạn có thể xem vé.'
              : 'Đơn đã hết hiệu lực hoặc đã hủy. Vui lòng đặt lại.',
        });
        return;
      }
      if (action === 'cancel') {
        onUpdated(await cancelBooking(current.id, contact, true));
        showSuccess('Đã hủy đơn đặt chỗ.');
      } else {
        const payment = await createStripePayment({
          bookingId: current.id,
          email: current.contactEmail || undefined,
        });
        window.location.assign(payment.checkoutUrl);
      }
    } catch (error) {
      try {
        onUpdated(await getBooking(booking.id, contact));
      } catch {
        /* Preserve state on network failure. */
      }
      showError(
        (error as Error).message ||
          'Không thể xử lý thanh toán. Vui lòng thử lại.',
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (booking.status === 'CONFIRMED') return null;
  return (
    <div className="space-y-2 print:hidden">
      {booking.status === 'PENDING' && !expired && deadline ? (
        <p className="text-xs text-amber-200">
          Thời gian thanh toán còn lại: {Math.floor(remaining / 60)}:
          {String(remaining % 60).padStart(2, '0')}
        </p>
      ) : null}
      {expired ? (
        <p className="text-xs text-amber-200">
          {showSecondaryActions
            ? 'Đã hết thời hạn thanh toán. Nếu đã trả tiền, hãy kiểm tra thông tin vé trước khi đặt lại.'
            : 'Đã hết thời hạn thanh toán. Nếu đã trả tiền, hãy chọn Xem vé để kiểm tra đơn trước khi đặt lại.'}
        </p>
      ) : null}
      <div
        className={`flex flex-wrap gap-2 ${showSecondaryActions ? '' : 'justify-center'}`}
      >
        {booking.status === 'PENDING' && !expired ? (
          <>
            <Button disabled={busy} onClick={() => void act('pay')}>
              Tiếp tục thanh toán
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void act('cancel')}
            >
              Hủy đơn
            </Button>
          </>
        ) : null}
        {showSecondaryActions && (expired || booking.status === 'CANCELLED') ? (
          <Link to={`/trips/${booking.trip.id}/select-seats`}>
            <Button variant="secondary">Đặt lại</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
};
