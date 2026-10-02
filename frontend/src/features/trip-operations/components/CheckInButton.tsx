import { useToast } from '../../../shared/providers/ToastProvider';
import { useState } from 'react';
import { apiClient } from '../../../shared/api/api';

interface CheckInButtonProps {
  tripId: number;
  bookingDetailId: number;
  isCheckedIn: boolean;
  blockedReason?: string | null;
  onCheckInSuccess: () => void;
}

export function CheckInButton({
  tripId,
  bookingDetailId,
  isCheckedIn,
  blockedReason,
  onCheckInSuccess,
}: CheckInButtonProps) {
  const { showError, confirm } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (loading || blockedReason) return;

    setLoading(true);
    try {
      if (
        isCheckedIn &&
        !(await confirm({
          title: 'Hoàn tác',
          message:
            'Bỏ xác nhận đã lên xe của hành khách này?',
          confirmText: 'Hoàn tác',
        }))
      )
        return;
      await apiClient(
        `/admin/trips/${tripId}/passengers/${bookingDetailId}/${isCheckedIn ? 'undo-check-in' : 'check-in'}`,
        {
          method: 'PATCH',
        },
      );
      onCheckInSuccess();
    } catch (error) {
      onCheckInSuccess();
      console.error('Check-in error:', error);
      showError(
        error instanceof Error
          ? error.message
          : 'Không thể xác nhận hành khách lên xe',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isCheckedIn && (
        <span className="text-green-400 font-medium text-sm">✓ Đã lên xe</span>
      )}
      <button
        onClick={handleCheckIn}
        disabled={loading || !!blockedReason}
        title={blockedReason || undefined}
        className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? 'Đang xử lý...'
          : isCheckedIn
            ? 'Hoàn tác'
            : 'Xác nhận lên xe'}
      </button>
    </div>
  );
}
