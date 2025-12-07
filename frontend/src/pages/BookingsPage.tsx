import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';
import type { Booking } from '../types/booking';
import { cancelBooking, getMyBookings, lookupBooking, updateBooking } from '../api/bookings';

export const BookingsPage = () => {
  const { user, accessToken } = useAuth();
  const { setContact } = useBooking();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lookupCode, setLookupCode] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<Booking | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [editContact, setEditContact] = useState({ name: '', phone: '', email: '' });
  const [editPassengers, setEditPassengers] = useState<
    { seatCode: string; name: string; phone?: string; idNumber?: string; price: number }[]
  >([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    getMyBookings(accessToken)
      .then(setBookings)
      .catch((err) => setError(err.message || 'Không thể tải danh sách đặt chỗ'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleCancel = async (id: string) => {
    const contact = lookupResult?.id === id ? { phone: lookupPhone, email: lookupEmail } : undefined;
    const confirmed = window.confirm('Bạn chắc muốn huỷ đặt chỗ này?');
    if (!confirmed) return;
    await cancelBooking(id, accessToken, contact);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'CANCELLED' } : b)));
    if (lookupResult?.id === id) setLookupResult({ ...lookupResult, status: 'CANCELLED' });
  };

  const handleLookup = async () => {
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const booking = await lookupBooking(lookupCode, lookupPhone, lookupEmail);
      setLookupResult(booking);
      setContact({ phone: booking.contactPhone, email: booking.contactEmail || undefined });
      setEditing(booking);
      setEditContact({ name: booking.contactName, phone: booking.contactPhone, email: booking.contactEmail || '' });
      setEditPassengers(
        booking.passengers.map((p) => ({
          seatCode: p.seatCode,
          name: p.name,
          phone: p.phone,
          idNumber: p.idNumber,
          price: p.price,
        })),
      );
    } catch (err) {
      setLookupError((err as Error)?.message || 'Không tìm thấy đặt chỗ');
    } finally {
      setLookupLoading(false);
    }
  };

  const startEdit = (booking: Booking) => {
    setEditing(booking);
    setEditContact({ name: booking.contactName, phone: booking.contactPhone, email: booking.contactEmail || '' });
    setEditPassengers(
      booking.passengers.map((p) => ({
        seatCode: p.seatCode,
        name: p.name,
        phone: p.phone,
        idNumber: p.idNumber,
        price: p.price,
      })),
    );
  };

  const updateEditPassenger = (seatCode: string, data: Partial<{ name: string; phone?: string; idNumber?: string }>) => {
    setEditPassengers((prev) => prev.map((p) => (p.seatCode === seatCode ? { ...p, ...data } : p)));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await updateBooking(
        editing.id,
        {
          contactName: editContact.name,
          contactPhone: editContact.phone,
          contactEmail: editContact.email,
          seats: editPassengers,
        },
        accessToken,
      );
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      if (lookupResult?.id === updated.id) setLookupResult(updated);
      setEditing(updated);
    } catch (err) {
      setEditError((err as Error)?.message || 'Không thể lưu thay đổi');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400">Bookings</p>
          <h1 className="text-3xl font-bold text-white">Quản lý đặt chỗ</h1>
          <p className="text-sm text-gray-300">Xem, sửa đổi, hoặc huỷ vé đã đặt. Hỗ trợ cả khách vãng lai.</p>
        </div>
        <Link to="/search">
          <Button variant="secondary">Đặt chuyến mới</Button>
        </Link>
      </div>

      {user ? (
        <Card title="Đặt chỗ của tôi">
          {loading ? <div className="text-sm text-gray-300">Đang tải...</div> : null}
          {error ? <div className="text-sm text-red-200">{error}</div> : null}
          {!loading && !bookings.length ? (
            <div className="text-sm text-gray-300">Chưa có đặt chỗ nào trong tài khoản.</div>
          ) : null}
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingRow key={b.id} booking={b} onCancel={handleCancel} onEdit={startEdit} />
            ))}
          </div>
        </Card>
      ) : null}

      <Card title="Tra cứu đặt chỗ (không cần đăng nhập)">
        <div className="grid md:grid-cols-3 gap-3">
          <FormField label="Mã đặt chỗ" value={lookupCode} onChange={(e) => setLookupCode(e.target.value)} />
          <FormField
            label="Số điện thoại"
            value={lookupPhone}
            placeholder="Dùng để xác thực"
            onChange={(e) => setLookupPhone(e.target.value)}
          />
          <FormField
            label="Email"
            value={lookupEmail}
            placeholder="Tuỳ chọn"
            onChange={(e) => setLookupEmail(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleLookup} disabled={lookupLoading || !lookupCode || (!lookupPhone && !lookupEmail)}>
            {lookupLoading ? 'Đang tìm...' : 'Tra cứu'}
          </Button>
          {lookupError ? <span className="text-sm text-red-200">{lookupError}</span> : null}
        </div>

        {lookupResult ? (
          <div className="mt-4">
            <BookingRow booking={lookupResult} onCancel={handleCancel} onEdit={startEdit} />
          </div>
        ) : null}
      </Card>

      {editing ? (
        <Card title={`Chỉnh sửa đặt chỗ ${editing.referenceCode}`}>
          {editError ? <div className="text-sm text-red-200 mb-2">{editError}</div> : null}
          <div className="grid md:grid-cols-3 gap-3">
            <FormField
              label="Người liên hệ"
              value={editContact.name}
              onChange={(e) => setEditContact((prev) => ({ ...prev, name: e.target.value }))}
            />
            <FormField
              label="Số điện thoại"
              value={editContact.phone}
              onChange={(e) => setEditContact((prev) => ({ ...prev, phone: e.target.value }))}
            />
            <FormField
              label="Email"
              value={editContact.email}
              onChange={(e) => setEditContact((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-3 mt-3">
            {editPassengers.map((p) => (
              <div key={p.seatCode} className="grid md:grid-cols-4 gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm text-white font-semibold md:col-span-4">Ghế {p.seatCode}</div>
                <FormField
                  label="Họ tên"
                  value={p.name}
                  onChange={(e) => updateEditPassenger(p.seatCode, { name: e.target.value })}
                  className="md:col-span-2"
                />
                <FormField
                  label="SĐT"
                  value={p.phone || ''}
                  onChange={(e) => updateEditPassenger(p.seatCode, { phone: e.target.value })}
                />
                <FormField
                  label="ID"
                  value={p.idNumber || ''}
                  onChange={(e) => updateEditPassenger(p.seatCode, { idNumber: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Đóng
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

const BookingRow = ({
  booking,
  onCancel,
  onEdit,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  onEdit?: (booking: Booking) => void;
}) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-white font-semibold">
        <span>{booking.trip.route.originCity.name}</span>
        <span className="text-gray-500">{'→'}</span>
        <span>{booking.trip.route.destinationCity.name}</span>
      </div>
      <div className="text-xs text-gray-400">
        {new Date(booking.trip.departureTime).toLocaleString()} · Ghế: {booking.passengers.map((p) => p.seatCode).join(', ')}
      </div>
      <div className="text-xs text-emerald-200">Mã: {booking.referenceCode}</div>
    </div>
    <div className="flex items-center gap-2">
      <Link to={`/bookings/${booking.id}/ticket`} state={{ booking }}>
        <Button variant="secondary">Xem vé</Button>
      </Link>
      <Button variant="ghost" onClick={() => onCancel(booking.id)} disabled={booking.status === 'CANCELLED'}>
        {booking.status === 'CANCELLED' ? 'Đã huỷ' : 'Huỷ vé'}
      </Button>
      {onEdit ? (
        <Button variant="ghost" onClick={() => onEdit(booking)}>
          Chỉnh sửa
        </Button>
      ) : null}
    </div>
  </div>
);
