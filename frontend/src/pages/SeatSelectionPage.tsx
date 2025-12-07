import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SeatMapView } from '../components/seats/SeatMapView';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { fetchSeatAvailability, lockSeats, refreshSeatLock, releaseSeatLock } from '../api/seats';
import { useAuth } from '../context/AuthContext';
import type { SeatAvailability, SeatWithState } from '../types/seatMap';

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const SeatSelectionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const [availability, setAvailability] = useState<SeatAvailability | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [lockInfo, setLockInfo] = useState<{ token: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadAvailability = useCallback(
    async (withSpinner = false) => {
      if (!id) return;
      if (withSpinner) setLoading(true);
      setError(null);
      try {
        const data = await fetchSeatAvailability(Number(id), lockInfo?.token);
        setAvailability(data);
        setSelectedSeats((prev) => {
          const selectable = new Set(
            data.seats
              .filter((s) => s.status !== 'locked' && s.status !== 'inactive')
              .map((s) => s.code),
          );
          const heldSeats = lockInfo
            ? data.seats.filter((s) => s.lockToken === lockInfo.token).map((s) => s.code)
            : [];
          if (lockInfo && !heldSeats.length) setLockInfo(null);
          if (lockInfo && heldSeats.length) {
            const lockedUntil = data.seats.find((s) => s.lockToken === lockInfo.token)?.lockedUntil;
            if (lockedUntil) setLockInfo({ token: lockInfo.token, expiresAt: lockedUntil });
            return Array.from(new Set(heldSeats));
          }
          return prev.filter((code) => selectable.has(code));
        });
      } catch (err) {
        setError((err as Error).message || 'Không thể tải sơ đồ ghế');
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [id, lockInfo],
  );

  useEffect(() => {
    loadAvailability(true);
    const interval = window.setInterval(() => loadAvailability(false), 15000);
    return () => window.clearInterval(interval);
  }, [loadAvailability]);

  useEffect(() => {
    if (!lockInfo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockInfo]);

  useEffect(() => {
    return () => {
      if (lockInfo && accessToken && id) {
        releaseSeatLock(Number(id), lockInfo.token, accessToken).catch(() => {});
      }
    };
  }, [lockInfo, accessToken, id]);

  const toggleSeat = (seat: SeatWithState) => {
    if (seat.status === 'locked' || seat.status === 'inactive') return;
    setSelectedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(seat.code)) next.delete(seat.code);
      else next.add(seat.code);
      return Array.from(next);
    });
  };

  const selectedSeatDetails = useMemo(() => {
    if (!availability) return [];
    const lookup = new Map(availability.seats.map((s) => [s.code, s]));
    return selectedSeats
      .map((code) => lookup.get(code))
      .filter((s): s is SeatWithState => Boolean(s));
  }, [availability, selectedSeats]);

  const totalPrice = useMemo(
    () =>
      selectedSeatDetails.reduce(
        (sum, seat) => sum + (seat?.price ?? availability?.trip.basePrice ?? 0),
        0,
      ),
    [selectedSeatDetails, availability?.trip.basePrice],
  );

  const remainingSeconds = useMemo(() => {
    if (!lockInfo) return 0;
    return Math.max(
      0,
      Math.floor((new Date(lockInfo.expiresAt).getTime() - now) / 1000),
    );
  }, [lockInfo, now]);

  const counts = useMemo(() => {
    const locked = availability?.seats.filter((s) => s.status === 'locked').length ?? 0;
    const held = availability?.seats.filter((s) => s.status === 'held').length ?? 0;
    const inactive = availability?.seats.filter((s) => s.status === 'inactive').length ?? 0;
    const total = availability?.seats.length ?? 0;
    const available = total - locked - held - inactive;
    return { locked, held, inactive, available, total };
  }, [availability?.seats]);

  const handleHold = async () => {
    if (!id) return;
    if (!selectedSeats.length) {
      setError('Chọn ít nhất 1 ghế để giữ.');
      return;
    }
    if (!accessToken) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await lockSeats(
        Number(id),
        { seats: selectedSeats, lockToken: lockInfo?.token },
        accessToken,
      );
      setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
      setAvailability(res.availability);
      const held = res.availability.seats
        .filter((s) => s.lockToken === res.lockToken)
        .map((s) => s.code);
      setSelectedSeats(held);
    } catch (err) {
      setError((err as Error).message || 'Không thể giữ ghế, vui lòng thử lại.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshHold = async () => {
    if (!id || !lockInfo || !accessToken) return;
    setActionLoading(true);
    try {
      const res = await refreshSeatLock(Number(id), lockInfo.token, accessToken);
      setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
      setAvailability(res.availability);
    } catch (err) {
      setError((err as Error).message || 'Không thể gia hạn giữ ghế.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!id || !lockInfo || !accessToken) return;
    setActionLoading(true);
    try {
      const res = await releaseSeatLock(Number(id), lockInfo.token, accessToken);
      setAvailability(res.availability);
      setSelectedSeats([]);
      setLockInfo(null);
    } catch (err) {
      setError((err as Error).message || 'Không thể hủy giữ ghế.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {'<- Quay lại'}
          </button>
          <h1 className="text-3xl font-bold text-white">Chọn ghế & giữ chỗ</h1>
          <p className="text-sm text-gray-300">
            Chạm vào ghế để chọn, giữ ghế tạm thời để tránh bị trùng khi thanh toán.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiết chuyến
        </Button>
      </div>

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

      {loading || !availability ? (
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-white/10 rounded w-1/3" />
            <div className="h-48 bg-white/5 rounded-xl" />
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-200">
                  <span className="text-lg font-semibold text-white">
                    {availability.trip.route.originCity.name} → {availability.trip.route.destinationCity.name}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {availability.seatMap.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(availability.trip.departureTime)} · {formatTime(availability.trip.departureTime)} khởi hành
                  </span>
                  <span className="text-xs text-gray-400">
                    Loại xe: {availability.trip.bus.busType || 'Tiêu chuẩn'} · {availability.trip.bus.name}
                  </span>
                </div>

                <SeatMapView
                  seatMap={availability.seatMap}
                  seats={availability.seats}
                  selected={selectedSeats}
                  onToggle={toggleSeat}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase text-gray-400">Tình trạng ghế</div>
                      <div className="text-lg font-semibold text-white">
                        {counts.available} trống · {counts.held} bạn giữ · {counts.locked} bị khóa
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Tổng {counts.total} ghế ({counts.inactive} không bán)
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-200">
                    {(availability.trip.bus.amenities || []).slice(0, 5).map((a) => (
                      <span key={a} className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase text-emerald-100">Ghế đã chọn</div>
                      <div className="text-xl font-bold text-white">
                        {selectedSeats.length ? selectedSeats.join(', ') : 'Chưa chọn'}
                      </div>
                      <div className="text-sm text-emerald-50">
                        Tổng tiền: <span className="font-semibold">{totalPrice.toLocaleString()} đ</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-200">Giá cơ bản</div>
                      <div className="text-lg font-semibold text-white">
                        {availability.trip.basePrice.toLocaleString()} đ
                      </div>
                      <div className="text-xs text-gray-400">Giá ghế có thể cao hơn</div>
                    </div>
                  </div>

                  {lockInfo ? (
                      <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-50 flex items-center justify-between">
                        <div>
                          Giữ ghế đến: {new Date(lockInfo.expiresAt).toLocaleTimeString()} · Còn{' '}
                          {Math.floor(remainingSeconds / 60)}:
                          {(remainingSeconds % 60).toString().padStart(2, '0')}
                        </div>
                        <Button
                          variant="ghost"
                          onClick={handleRefreshHold}
                          disabled={actionLoading}
                          className="px-3 py-1 text-xs"
                        >
                          Gia hạn +5p
                        </Button>
                      </div>
                  ) : (
                    <div className="text-xs text-gray-300">
                      Giữ ghế trong 5-30 phút để tránh bị người khác chọn trong lúc bạn thanh toán.
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleHold} disabled={actionLoading || selectedSeats.length === 0}>
                      {lockInfo ? 'Cập nhật giữ ghế' : 'Giữ ghế ngay'}
                    </Button>
                    {lockInfo ? (
                      <Button variant="secondary" onClick={handleRelease} disabled={actionLoading}>
                        Hủy giữ ghế
                      </Button>
                    ) : null}
                    {!user ? (
                      <Button variant="ghost" onClick={() => navigate('/login')}>
                        Đăng nhập để đặt
                      </Button>
                    ) : null}
                  </div>

                  {selectedSeatDetails.length ? (
                    <div className="border-t border-white/10 pt-3 space-y-2 text-sm text-gray-100">
                      {selectedSeatDetails.map((seat) => (
                        <div
                          key={seat.code}
                          className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{seat.code}</span>
                            <span className="text-xs uppercase text-gray-400">{seat.seatType || 'standard'}</span>
                          </div>
                          <span className="text-emerald-200 font-semibold">{seat.price.toLocaleString()} đ</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
