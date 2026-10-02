import { statusLabel } from '../../../shared/utils/displayLabels';
import { useToast } from '../../../shared/providers/ToastProvider';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { Booking, BookingStatus } from '../types/booking';
import { BookingDetailDrawer } from '../components/BookingDetailDrawer';
import { RefundModal } from '../components/RefundModal';

const bookingStatusClass: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-600/30 text-yellow-300',
  CONFIRMED: 'bg-green-600/30 text-green-300',
  CANCELLED: 'bg-error/30 text-error',
  EXPIRED: 'bg-gray-600/30 text-gray-400',
};

export const AdminBookingsPage = () => {
  const { showError, confirm, showSuccess } = useToast();
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [filters, setFilters] = useState<{
    status?: BookingStatus | '';
    fromDate?: string;
    toDate?: string;
    search?: string;
    limit: number;
    offset: number;
  }>({
    limit: 20,
    offset: 0,
  });

  const loadBookings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);
    if (filters.search) params.append('search', filters.search);
    params.append('limit', String(filters.limit));
    params.append('offset', String(filters.offset));

    try {
      const response = await apiClient<{
        data: Booking[];
        total: number;
        limit: number;
        offset: number;
      }>(`/admin/bookings?${params.toString()}`);

      setBookings(response.data);
      setTotal(response.total);
    } catch (err) {
      showError((err as Error).message || 'Không thể tải danh sách đặt chỗ');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, showError]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const viewDetails = async (booking: Booking) => {
    try {
      const detailed = await apiClient<Booking>(
        `/admin/bookings/${booking.reference ?? booking.id}`,
      );
      setSelectedBooking(detailed);
    } catch (err) {
      showError((err as Error).message || 'Không thể tải chi tiết đặt chỗ');
    }
  };

  const updateStatus = async (reference: string, status: BookingStatus) => {
    if (
      !(await confirm({
        message: `Bạn có chắc muốn đổi trạng thái đặt chỗ này sang ${statusLabel(status)}?`,
        danger: true,
      }))
    )
      return;

    try {
      await apiClient(`/admin/bookings/${reference}/status`, {
        method: 'PATCH',
        body: { status },
      });

      showSuccess('Cập nhật trạng thái thành công!');
      void loadBookings();
      setSelectedBooking(null);
    } catch (err) {
      showError((err as Error).message || 'Không thể cập nhật trạng thái');
    }
  };

  const openRefundModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setShowRefundModal(true);
  };

  const handleRefundSuccess = () => {
    setShowRefundModal(false);
    setSelectedBooking(null);
    showSuccess('Hoàn tiền thành công!');
    void loadBookings();
  };

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  const goToPage = (page: number) => {
    setFilters((f) => ({ ...f, offset: (page - 1) * f.limit }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-center text-2xl font-bold text-white">
        Quản lý đặt chỗ
      </h1>

      <Card title="Bộ lọc">
        <div className="grid md:grid-cols-4 gap-4">
          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Trạng thái</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200 [color-scheme:dark] [&>option]:bg-slate-900 [&>option]:text-gray-100"
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: (e.target.value as BookingStatus) || undefined,
                  offset: 0,
                }))
              }
            >
              <option value="">Tất cả</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="CONFIRMED">Đã xác nhận</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="EXPIRED">Hết hạn</option>
            </select>
          </label>

          <FormField
            label="Từ ngày khởi hành"
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, fromDate: e.target.value, offset: 0 }))
            }
          />

          <FormField
            label="Đến ngày khởi hành"
            type="date"
            value={filters.toDate ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, toDate: e.target.value, offset: 0 }))
            }
          />

          <FormField
            label="Tìm kiếm"
            placeholder="Tên, email, hoặc mã đặt chỗ..."
            value={filters.search ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value, offset: 0 }))
            }
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="secondary"
            onClick={() => setFilters((f) => ({ limit: f.limit, offset: 0 }))}
          >
            Xóa bộ lọc
          </Button>
        </div>
      </Card>

      <Card title={loading ? 'Đang tải...' : `Danh sách đặt chỗ (${total})`}>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-8 gap-3 text-xs uppercase text-gray-400 border-b border-white/5 pb-2 min-w-[1000px]">
            <div>Mã đặt chỗ</div>
            <div>Khách hàng</div>
            <div>Tuyến</div>
            <div>Ngày đi</div>
            <div>Số ghế</div>
            <div>Tổng tiền</div>
            <div>Trạng thái</div>
            <div className="text-right">Thao tác</div>
          </div>

          <div className="divide-y divide-white/5 text-sm text-gray-200 min-w-[1000px]">
            {bookings.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                Không có lượt đặt chỗ nào
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="grid grid-cols-8 gap-3 py-3 items-center"
                >
                  <div className="font-mono text-primary">
                    {booking.reference ?? booking.id}
                  </div>
                  <div>
                    <div className="font-semibold text-white">
                      {booking.contactName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {booking.contactEmail}
                    </div>
                  </div>
                  <div className="text-xs">
                    {booking.trip.route.originCity.name} →{' '}
                    {booking.trip.route.destinationCity.name}
                  </div>
                  <div className="text-xs">
                    {new Date(booking.trip.departureTime).toLocaleDateString(
                      'vi-VN',
                      { timeZone: 'Asia/Ho_Chi_Minh' },
                    )}
                  </div>
                  <div>{booking.details.length} ghế</div>
                  <div className="font-semibold text-white">
                    {booking.totalPrice.toLocaleString('vi-VN')}đ
                  </div>
                  <div>
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs ${
                        bookingStatusClass[booking.status]
                      }`}
                    >
                      {statusLabel(booking.status)}
                    </span>
                  </div>
                  <div className="text-right space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() => viewDetails(booking)}
                    >
                      Chi tiết
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
            <div className="text-sm text-gray-400">
              Trang {currentPage} / {totalPages} (Tổng: {total} lượt đặt chỗ)
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Trước
              </Button>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'primary' : 'ghost'}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="ghost"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selectedBooking && !showRefundModal && (
        <BookingDetailDrawer
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={updateStatus}
          onRefund={() => openRefundModal(selectedBooking)}
        />
      )}

      {selectedBooking && showRefundModal && (
        <RefundModal
          booking={selectedBooking}
          onClose={() => setShowRefundModal(false)}
          onSuccess={handleRefundSuccess}
        />
      )}
    </div>
  );
};
