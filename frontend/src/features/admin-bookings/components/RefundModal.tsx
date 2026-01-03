import { useState } from 'react';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import type { Booking } from '../types/booking';

type Props = {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
  accessToken: string;
};

export const RefundModal = ({
  booking,
  onClose,
  onSuccess,
  accessToken,
}: Props) => {
  const [amount, setAmount] = useState(booking.totalPrice);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'MANUAL' | 'GATEWAY'>('MANUAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    if (amount <= 0 || amount > booking.totalPrice) {
      setError('Số tiền hoàn không hợp lệ');
      return;
    }

    setLoading(true);

    try {
      await apiClient(`/admin/bookings/${booking.reference}/refund`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: { amount, reason, method },
      });

      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Không thể xử lý hoàn tiền');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-surface rounded-xl p-6 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Xử lý hoàn tiền</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-2">Booking</div>
            <div className="text-white font-mono">{booking.reference}</div>
          </div>

          <div>
            <div className="text-sm text-gray-400 mb-2">Tổng tiền đã thanh toán</div>
            <div className="text-white font-semibold">
              {booking.totalPrice.toLocaleString('vi-VN')}đ
            </div>
          </div>

          <FormField
            label="Số tiền hoàn"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={0}
            max={booking.totalPrice}
            required
          />

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
              onChange={(e) => setMethod(e.target.value as 'MANUAL' | 'GATEWAY')}
            >
              <option value="MANUAL">Thủ công (chuyển khoản trực tiếp)</option>
              <option value="GATEWAY">Qua cổng thanh toán</option>
            </select>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
              {error}
            </div>
          )}

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
