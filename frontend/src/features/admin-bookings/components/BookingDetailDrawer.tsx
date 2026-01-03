import { Button } from '../../../shared/components/ui/Button';
import type { Booking, BookingStatus } from '../types/booking';

type Props = {
  booking: Booking;
  onClose: () => void;
  onUpdateStatus: (reference: string, status: BookingStatus) => void;
  onRefund: () => void;
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

export const BookingDetailDrawer = ({
  booking,
  onClose,
  onUpdateStatus,
  onRefund,
}: Props) => {
  const canConfirm = booking.status === 'PENDING';
  const canCancel =
    booking.status !== 'CANCELLED' && booking.status !== 'EXPIRED';
  const canRefund =
    booking.payment?.status === 'SUCCESS' &&
    booking.payment.refundedAt === undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
      <div className="h-full w-full max-w-2xl bg-surface overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Chi tiết Booking</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Booking Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Thông tin chung
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Mã booking</div>
                <div className="text-white font-mono">{booking.reference}</div>
              </div>
              <div>
                <div className="text-gray-400">Trạng thái</div>
                <div className="text-white">{statusLabel[booking.status]}</div>
              </div>
              <div>
                <div className="text-gray-400">Ngày đặt</div>
                <div className="text-white">
                  {new Date(booking.createdAt).toLocaleString('vi-VN')}
                </div>
              </div>
              <div>
                <div className="text-gray-400">Tổng tiền</div>
                <div className="text-white font-semibold">
                  {booking.totalPrice.toLocaleString('vi-VN')}đ
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Thông tin liên hệ
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Họ tên: </span>
                <span className="text-white">{booking.contactName}</span>
              </div>
              <div>
                <span className="text-gray-400">Email: </span>
                <span className="text-white">{booking.contactEmail}</span>
              </div>
              {booking.contactPhone && (
                <div>
                  <span className="text-gray-400">Số điện thoại: </span>
                  <span className="text-white">{booking.contactPhone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Trip Info */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Thông tin chuyến đi
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Tuyến: </span>
                <span className="text-white">{booking.trip.route.name}</span>
              </div>
              <div>
                <span className="text-gray-400">Từ: </span>
                <span className="text-white">
                  {booking.trip.route.originCity.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Đến: </span>
                <span className="text-white">
                  {booking.trip.route.destinationCity.name}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Giờ khởi hành: </span>
                <span className="text-white">
                  {new Date(booking.trip.departureTime).toLocaleString('vi-VN')}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Xe: </span>
                <span className="text-white">
                  {booking.trip.bus.name} ({booking.trip.bus.plateNumber})
                </span>
              </div>
            </div>
          </div>

          {/* Passengers */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Danh sách hành khách ({booking.details.length})
            </h3>
            <div className="space-y-2">
              {booking.details.map((detail) => (
                <div
                  key={detail.id}
                  className="p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold">
                        {detail.passengerName}
                      </div>
                      <div className="text-xs text-gray-400">
                        Ghế: {detail.seatCodeSnapshot} •{' '}
                        {detail.priceSnapshot.toLocaleString('vi-VN')}đ
                      </div>
                      {detail.passengerPhone && (
                        <div className="text-xs text-gray-400">
                          SĐT: {detail.passengerPhone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Info */}
          {booking.payment && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">
                Thông tin thanh toán
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Phương thức: </span>
                  <span className="text-white">{booking.payment.provider}</span>
                </div>
                <div>
                  <span className="text-gray-400">Trạng thái: </span>
                  <span className="text-white">{booking.payment.status}</span>
                </div>
                <div>
                  <span className="text-gray-400">Số tiền: </span>
                  <span className="text-white">
                    {booking.payment.amount.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                {booking.payment.refundedAt && (
                  <div className="mt-4 p-3 rounded-lg bg-error/10 border border-error/30">
                    <div className="text-error font-semibold mb-2">
                      Đã hoàn tiền
                    </div>
                    <div>
                      <span className="text-gray-400">Số tiền hoàn: </span>
                      <span className="text-white">
                        {booking.payment.refundAmount?.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Lý do: </span>
                      <span className="text-white">
                        {booking.payment.refundReason}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Phương thức: </span>
                      <span className="text-white">
                        {booking.payment.refundMethod}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Thời gian: </span>
                      <span className="text-white">
                        {new Date(
                          booking.payment.refundedAt,
                        ).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-lg font-semibold text-white">Hành động</h3>
            <div className="flex flex-wrap gap-3">
              {canConfirm && (
                <Button
                  onClick={() => onUpdateStatus(booking.reference, 'CONFIRMED')}
                >
                  Xác nhận booking
                </Button>
              )}

              {canCancel && (
                <Button
                  variant="ghost"
                  onClick={() => onUpdateStatus(booking.reference, 'CANCELLED')}
                >
                  Hủy booking
                </Button>
              )}

              {canRefund && (
                <Button variant="secondary" onClick={onRefund}>
                  Xử lý hoàn tiền
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
