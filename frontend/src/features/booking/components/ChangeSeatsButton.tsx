import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/components/ui/Button';
import { useToast } from '../../../shared/providers/ToastProvider';
import { cancelBooking } from '../api/bookings';
import { releaseSeats } from '../api/seats';
import { useBooking } from '../context/BookingContext';

export const ChangeSeatsButton = ({
  disabled = false,
  onChanged,
}: {
  disabled?: boolean;
  onChanged?: () => void;
}) => {
  const {
    hold,
    pendingBooking,
    resetSelection,
    changingSeats,
    setChangingSeats,
  } = useBooking();
  const { confirm, showError } = useToast();
  const navigate = useNavigate();
  const busy = useRef(false);

  const changeSeats = async () => {
    if (!hold || busy.current || changingSeats) return;
    busy.current = true;
    setChangingSeats(true);
    try {
      if (
        !(await confirm({
          title: 'Chọn lại ghế',
          message: pendingBooking
            ? 'Hủy đơn đang chờ thanh toán để chọn ghế khác?'
            : 'Nhả các ghế đang giữ để chọn lại? Thông tin liên hệ sẽ được giữ lại, thông tin hành khách theo ghế cần nhập lại.',
          confirmText: 'Chọn lại ghế',
          cancelText: 'Giữ ghế hiện tại',
        }))
      )
        return;

      if (pendingBooking) {
        await cancelBooking(
          pendingBooking.id,
          {
            email: pendingBooking.email,
            phone: pendingBooking.phone,
          },
          true,
        );
      } else if (new Date(hold.expiresAt).getTime() > Date.now()) {
        await releaseSeats(hold.tripId, hold.seatCodes, hold.lockToken);
      }
      resetSelection();
      navigate(`/trips/${hold.tripId}/select-seats`, { replace: true });
      onChanged?.();
    } catch (error) {
      showError(
        (error as Error).message || 'Không thể nhả ghế. Vui lòng thử lại.',
      );
    } finally {
      busy.current = false;
      setChangingSeats(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled || changingSeats}
      onClick={() => void changeSeats()}
    >
      {changingSeats ? 'Đang xử lý...' : 'Chọn lại ghế'}
    </Button>
  );
};
