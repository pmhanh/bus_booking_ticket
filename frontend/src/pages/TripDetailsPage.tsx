import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getTripById } from '../api/trips';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import type { Trip } from '../types/trip';
import { SeatSelector } from '../components/booking/SeatSelector';
import { useBooking } from '../context/BookingContext';
import { useAuth } from '../context/AuthContext';

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatDuration = (minutes?: number) => {
  if (!minutes && minutes !== 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
};

export const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [trip, setTripData] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    setTrip: setBookingTrip,
    selectedSeats,
    passengers,
    contact,
    toggleSeat,
    updatePassenger,
    setContact,
    totalPrice,
  } = useBooking();
  const { user } = useAuth();
  const bookingSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTripById(Number(id))
      .then((data) => {
        setTripData(data);
        setBookingTrip(data);
      })
      .catch((err) => setError(err.message || 'Unable to load trip'))
      .finally(() => setLoading(false));
  }, [id, setBookingTrip]);

  useEffect(() => {
    if (!user) return;
    if (!contact.name && (user.fullName || user.email)) setContact({ name: user.fullName || user.email || '' });
    if (!contact.email && user.email) setContact({ email: user.email });
    if (!contact.phone && user.phone) setContact({ phone: user.phone });
  }, [user, contact.email, contact.name, contact.phone, setContact]);

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchState = useMemo(
    () =>
      (location.state as {
        search?: {
          originId?: number;
          destinationId?: number;
          date?: string;
          originName?: string;
          destinationName?: string;
        };
      } | undefined)?.search,
    [location.state],
  );
  const headerOrigin = searchState?.originName || urlParams.get('originName') || trip?.route.originCity.name;
  const headerDestination =
    searchState?.destinationName || urlParams.get('destinationName') || trip?.route.destinationCity.name;
  const headerDate = searchState?.date || urlParams.get('date') || trip?.departureTime?.split('T')[0];
  const backQuery = useMemo(() => {
    const qs = new URLSearchParams();
    const originId = searchState?.originId || (urlParams.get('originId') ? Number(urlParams.get('originId')) : undefined);
    const destinationId =
      searchState?.destinationId || (urlParams.get('destinationId') ? Number(urlParams.get('destinationId')) : undefined);
    const date = searchState?.date || urlParams.get('date');
    const originName = searchState?.originName || urlParams.get('originName');
    const destinationName = searchState?.destinationName || urlParams.get('destinationName');
    if (originId) {
      qs.set('originId', String(originId));
      if (originName) qs.set('originName', originName);
    }
    if (destinationId) {
      qs.set('destinationId', String(destinationId));
      if (destinationName) qs.set('destinationName', destinationName);
    }
    if (date) qs.set('date', date);
    return qs.toString() ? `?${qs.toString()}` : '';
  }, [searchState, urlParams]);

  const stops = useMemo(() => trip?.route?.stops?.slice().sort((a, b) => a.order - b.order) || [], [trip]);
  const readyForReview =
    !!trip &&
    selectedSeats.length > 0 &&
    passengers.every((p) => p.name.trim()) &&
    contact.name.trim().length > 0 &&
    (contact.phone?.trim() || contact.email?.trim());

  const handleSeatToggle = (seat: { code: string; price: number; status?: string }) => {
    if (seat.status && seat.status !== 'available' && !selectedSeats.find((s) => s.code === seat.code)) return;
    toggleSeat({ code: seat.code, price: seat.price });
    if (bookingSectionRef.current) {
      bookingSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const state = location.state as { jumpToBooking?: boolean } | undefined;
    if (state?.jumpToBooking && bookingSectionRef.current) {
      bookingSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.state]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {'<- Quay lại kết quả'}
          </button>
          <h1 className="text-3xl font-bold text-white">Chi tiết chuyến</h1>
          <p className="text-gray-300 text-sm">Thông tin tuyến, thời gian, loại xe và tiện ích</p>
          {headerOrigin && headerDestination && headerDate ? (
            <p className="text-sm text-emerald-100">
              Đang xem chuyến: {headerOrigin} {'->'} {headerDestination} ngày {headerDate}
            </p>
          ) : null}
        </div>
        <Link to={backQuery ? `/search${backQuery}` : '/search'}>
          <Button variant="secondary">Tìm lại</Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-2/3" />
            <div className="h-4 bg-white/10 rounded" />
          </div>
        </Card>
      ) : null}

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

      {!loading && trip ? (
        <>
          <Card>
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="space-y-3">
                <div className="text-xs uppercase text-gray-400">Tuyến</div>
                <div className="flex items-center gap-3 text-white text-2xl font-semibold">
                  <span>{trip.route.originCity.name}</span>
                  <span className="text-gray-500 text-lg">{'->'}</span>
                  <span>{trip.route.destinationCity.name}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-100">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
                    <div className="text-xl font-semibold text-white">{formatTime(trip.departureTime)}</div>
                    <div className="text-gray-400 text-xs">{formatDate(trip.departureTime)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Giờ đến</div>
                    <div className="text-xl font-semibold text-white">{formatTime(trip.arrivalTime)}</div>
                    <div className="text-gray-400 text-xs">{formatDate(trip.arrivalTime)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Thời lượng</div>
                    <div className="text-xl font-semibold text-white">
                      {formatDuration(trip.durationMinutes)}
                    </div>
                    <div className="text-gray-400 text-xs">Ước tính tuyến: {trip.route.estimatedDurationMinutes} phút</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Trạng thái</div>
                    <div className="text-xl font-semibold text-white">{trip.status}</div>
                    <div className="text-gray-400 text-xs">Cập nhật khi đã đặt</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-emerald-100">Từ</div>
                    <div className="text-3xl font-bold text-white">{trip.basePrice.toLocaleString()} VND</div>
                    <div className="text-xs text-emerald-50">Giá cơ bản mỗi ghế</div>
                  </div>
                  <Link
                    to={
                      backQuery ? `/trips/${trip.id}/select-seats${backQuery}` : `/trips/${trip.id}/select-seats`
                    }
                    state={{ search: searchState }}
                  >
                    <Button>Đặt ngay</Button>
                  </Link>
                </div>
                <div className="text-xs text-emerald-50">
                  Ghế, dịch vụ thêm và thông tin hành khách sẽ chọn trong bước đặt vé.
                </div>
              </div>
            </div>
          </Card>

          <div ref={bookingSectionRef} className="grid lg:grid-cols-[1.4fr_0.6fr] gap-4">
            <Card title="Chọn ghế & hành khách">
              <SeatSelector
                tripId={trip.id}
                selected={selectedSeats.map((s) => s.code)}
                onToggle={(seat) => handleSeatToggle({ code: seat.code, price: seat.price, status: seat.status })}
              />

              <div className="mt-4 space-y-3">
                {selectedSeats.length === 0 ? (
                  <div className="text-sm text-gray-300">
                    Chọn ghế đang trống để điền thông tin hành khách. Trạng thái ghế tự động cập nhật mỗi vài giây.
                  </div>
                ) : (
                  selectedSeats.map((seat) => {
                    const passenger =
                      passengers.find((p) => p.seatCode === seat.code) || {
                        seatCode: seat.code,
                        name: '',
                        phone: '',
                        idNumber: '',
                        price: seat.price ?? trip.basePrice,
                      };
                    const seatPrice = passenger.price ?? seat.price ?? trip.basePrice;
                    return (
                      <div
                        key={seat.code}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 grid md:grid-cols-4 gap-3 items-end"
                      >
                        <div className="md:col-span-4 flex items-center justify-between">
                          <div className="text-sm text-white font-semibold">Ghế {seat.code}</div>
                          <div className="text-xs text-emerald-200">
                            {seatPrice.toLocaleString()} đ · Liên tục giữ 5s / lần
                          </div>
                        </div>
                        <FormField
                          label="Họ tên hành khách"
                          value={passenger.name}
                          placeholder="Ví dụ: Tran An"
                          onChange={(e) => updatePassenger(seat.code, { name: e.target.value })}
                          className="md:col-span-2"
                        />
                        <FormField
                          label="Số điện thoại"
                          value={passenger.phone || ''}
                          placeholder="Tuỳ chọn"
                          onChange={(e) => updatePassenger(seat.code, { phone: e.target.value })}
                        />
                        <FormField
                          label="CCCD/Passport"
                          value={passenger.idNumber || ''}
                          placeholder="Tuỳ chọn"
                          onChange={(e) => updatePassenger(seat.code, { idNumber: e.target.value })}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card title="Thông tin liên hệ & tóm tắt">
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <FormField
                    label="Người liên hệ"
                    value={contact.name}
                    placeholder="Tên để chúng tôi liên hệ"
                    onChange={(e) => setContact({ name: e.target.value })}
                  />
                  <FormField
                    label="Email"
                    type="email"
                    value={contact.email || ''}
                    placeholder="Nhận e-ticket"
                    onChange={(e) => setContact({ email: e.target.value })}
                  />
                  <FormField
                    label="Số điện thoại"
                    value={contact.phone || ''}
                    placeholder="Bắt buộc để hỗ trợ"
                    onChange={(e) => setContact({ phone: e.target.value })}
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-sm text-gray-200">
                  <div className="flex items-center justify-between text-gray-400 text-xs uppercase">
                    <span>Hành khách</span>
                    <span>Giá</span>
                  </div>
                  {passengers.length ? (
                    passengers.map((p) => (
                      <div key={p.seatCode} className="flex items-center justify-between">
                        <div className="text-white">
                          {p.name || 'Chưa nhập'} · Ghế {p.seatCode}
                        </div>
                        <div className="text-emerald-200">{(p.price ?? trip.basePrice).toLocaleString()} đ</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400">Chưa có hành khách.</div>
                  )}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-white font-semibold">
                    <span>Tạm tính</span>
                    <span>{totalPrice.toLocaleString()} đ</span>
                  </div>
                </div>

                <Button
                  disabled={!readyForReview}
                  onClick={() => navigate('/bookings/review', { state: { fromTrip: trip.id } })}
                  className="w-full"
                >
                  Xem lại & thanh toán
                </Button>
                {!readyForReview ? (
                  <div className="text-xs text-gray-400 text-center">
                    Cần chọn ghế, nhập tên hành khách và thông tin liên hệ để tiếp tục.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
            <Card title="Lộ trình">
              {stops.length ? (
                <div className="space-y-4">
                  {stops.map((stop, index) => (
                    <div key={stop.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-emerald-400" />
                        {index < stops.length - 1 ? (
                          <div className="flex-1 w-px bg-white/10" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white font-semibold">{stop.city.name}</div>
                        <div className="text-xs text-gray-400 uppercase">{stop.type}</div>
                        <div className="text-xs text-gray-400">
                          Cách điểm đầu: {stop.estimatedOffsetMinutes} phút
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-300">Chưa có điểm dừng trung gian cho tuyến này.</div>
              )}
            </Card>

            <Card title="Thông tin xe & tiện ích">
              <div className="space-y-3 text-sm text-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-gray-400">Xe</div>
                    <div className="text-lg font-semibold text-white">{trip.bus.name}</div>
                    <div className="text-xs text-gray-400">
                      {trip.bus.busType || 'Tiêu chuẩn'} · {trip.bus.plateNumber}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {trip.bus.seatMap?.name || 'Chưa có sơ đồ ghế'}
                  </span>
                </div>

                <div>
                  <div className="text-xs uppercase text-gray-400 mb-2">Tiện ích</div>
                  <div className="flex flex-wrap gap-2">
                    {(trip.bus.amenities || []).length ? (
                      trip.bus.amenities!.map((a) => (
                        <span key={a} className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">Chưa có tiện ích</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs uppercase text-gray-400">Cần hỗ trợ?</div>
                  <p className="text-sm text-gray-200">
                    Chat với nhân viên nếu cần giữ ghế, đặt nhóm hoặc ghi chú đón trả riêng. Phản hồi trong 5 phút (giờ làm việc).
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary">Chat nhanh</Button>
                    <Button variant="ghost">Gọi hỗ trợ</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
