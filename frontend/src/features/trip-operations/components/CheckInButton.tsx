import { useState } from 'react';
import { apiClient } from '../../../shared/api/api';

interface CheckInButtonProps {
  tripId: number;
  bookingDetailId: number;
  isCheckedIn: boolean;
  onCheckInSuccess: () => void;
}

export function CheckInButton({
  tripId,
  bookingDetailId,
  isCheckedIn,
  onCheckInSuccess,
}: CheckInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    if (isCheckedIn) return;

    setLoading(true);
    try {
      await apiClient(`/admin/trips/${tripId}/passengers/${bookingDetailId}/check-in`, {
        method: 'PATCH',
      });
      onCheckInSuccess();
    } catch (error) {
      console.error('Check-in error:', error);
      alert(error instanceof Error ? error.message : 'Failed to check in passenger');
    } finally {
      setLoading(false);
    }
  };

  if (isCheckedIn) {
    return (
      <span className="text-green-400 font-medium text-sm">
        ✓ Checked In
      </span>
    );
  }

  return (
    <button
      onClick={handleCheckIn}
      disabled={loading}
      className="px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Checking in...' : 'Check In'}
    </button>
  );
}
