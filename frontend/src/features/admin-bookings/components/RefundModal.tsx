import { useToast } from '../../../shared/providers/ToastProvider';
import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { apiClient } from '../../../shared/api/api';
import type { Booking } from '../types/booking';

type Props = {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
};

export const RefundModal = ({ booking, onClose, onSuccess }: Props) => {
  const { showError } = useToast();
  const remaining =
    (booking.payment?.amount ?? booking.totalPrice) -
    (booking.payment?.refundAmount ?? 0);
  const pending =
    booking.payment?.pendingRefund?.status === 'PENDING'
      ? booking.payment.pendingRefund
      : null;
  const [requestId] = useState(() => pending?.requestId ?? crypto.randomUUID());

  const [reason, setReason] = useState(pending?.reason ?? '');
  const [method, setMethod] = useState<'MANUAL' | 'GATEWAY'>(
    pending?.method ?? 'GATEWAY',
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      showError('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    setLoading(true);

    try {
      await apiClient(
        `/admin/bookings/${booking.reference ?? booking.id}/refund`,
        { method: 'POST', body: { requestId, reason, method } },
      );

      onSuccess();
    } catch (err) {
      showError((err as Error).message || 'Không thể xử lý hoàn tiền');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-surface rounded-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Xử lý hoàn tiền</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-2">Mã đặt chỗ</div>
            <div className="text-white font-mono">
              {booking.reference ?? booking.id}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-400 mb-2">
              Tổng tiền đã thanh toán
            </div>
            <div className="text-white font-semibold">
              {booking.totalPrice.toLocaleString('vi-VN')}đ
            </div>
          </div>

          <p className="text-sm text-gray-300">
            Hoàn toàn bộ: {remaining.toLocaleString('vi-VN')}đ
          </p>

          <div>
            <label className="block text-sm text-gray-200 mb-2">
              Lý do hoàn tiền <span className="text-error">*</span>
            </label>
            <textarea
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200 min-h-[100px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do hoàn tiền..."
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-200 mb-2">
              Phương thức hoàn tiền
            </label>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as 'MANUAL' | 'GATEWAY')
              }
            >
              <option value="MANUAL">Thủ công (chuyển khoản trực tiếp)</option>
              <option value="GATEWAY">Qua cổng thanh toán</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Xác nhận hoàn tiền'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
