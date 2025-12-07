import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SeatMapView } from '../components/seats/SeatMapView';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
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
  const [passengers, setPassengers] = useState<
    { seatCode: string; name: string; phone?: string; idNumber?: string }[]
  >([]);

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
        setError((err as Error).message || 'KhÃ´ng thá»ƒ táº£i sÆ¡ Ä‘á»“ gháº¿');
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
      if (lockInfo && id) {
        releaseSeatLock(Number(id), lockInfo.token, accessToken || undefined).catch(() => {});
      }
    };
  }, [lockInfo, accessToken, id]);

  const toggleSeat = async (seat: SeatWithState) => {
    if (seat.status === 'locked' || seat.status === 'inactive') return;
    const next = new Set(selectedSeats);
    if (next.has(seat.code)) next.delete(seat.code);
    else next.add(seat.code);
    const nextSeats = Array.from(next);
    setSelectedSeats(nextSeats);
    setPassengers((prev) => {
      const kept = prev.filter((p) => next.has(p.seatCode));
      if (next.has(seat.code) && !kept.find((p) => p.seatCode === seat.code)) {
        kept.push({ seatCode: seat.code, name: '' });
      }
      return kept;
    });
    if (!id) return;
    if (lockInfo && nextSeats.length === 0) {
      setActionLoading(true);
      try {
        const res = await releaseSeatLock(Number(id), lockInfo.token, accessToken || undefined);
        setAvailability(res.availability);
        setLockInfo(null);
      } catch {
        /* ignore */
      } finally {
        setActionLoading(false);
      }
      return;
    }
    if (nextSeats.length) {
      setActionLoading(true);
      setError(null);
      try {
        const res = await lockSeats(
          Number(id),
          { seats: nextSeats, lockToken: lockInfo?.token },
          accessToken || undefined,
        );
        setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
        setAvailability(res.availability);
        setSelectedSeats(res.availability.seats.filter((s) => s.lockToken === res.lockToken).map((s) => s.code));
      } catch (err) {
        setError((err as Error).message || 'KhÃ´ng giá»¯ Ä‘Æ°á»£c gháº¿.');
      } finally {
        setActionLoading(false);
      }
    }
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

  const updatePassenger = (seatCode: string, data: Partial<{ name: string; phone?: string; idNumber?: string }>) => {
    setPassengers((prev) =>
      prev.map((p) => (p.seatCode === seatCode ? { ...p, ...data } : p)),
    );
  };

  const handleHold = async () => {
    if (!id) return;
    if (!selectedSeats.length) {
      setError('Chá»n Ã­t nháº¥t 1 gháº¿ Ä‘á»ƒ giá»¯.');
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
      setError((err as Error).message || 'KhÃ´ng thá»ƒ giá»¯ gháº¿, vui lÃ²ng thá»­ láº¡i.');
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
      setError((err as Error).message || 'KhÃ´ng thá»ƒ gia háº¡n giá»¯ gháº¿.');
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
      setError((err as Error).message || 'KhÃ´ng thá»ƒ há»§y giá»¯ gháº¿.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {'<- Quay láº¡i'}
          </button>
          <h1 className="text-3xl font-bold text-white">Chá»n gháº¿ & giá»¯ chá»—</h1>
          <p className="text-sm text-gray-300">
            Cháº¡m vÃ o gháº¿ Ä‘á»ƒ chá»n, giá»¯ gháº¿ táº¡m thá»i Ä‘á»ƒ trÃ¡nh bá»‹ trÃ¹ng khi thanh toÃ¡n.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiáº¿t chuyáº¿n
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
                    {availability.trip.route.originCity.name} â†’ {availability.trip.route.destinationCity.name}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {availability.seatMap.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(availability.trip.departureTime)} Â· {formatTime(availability.trip.departureTime)} khá»Ÿi hÃ nh
                  </span>
                  <span className="text-xs text-gray-400">
                    Loáº¡i xe: {availability.trip.bus.busType || 'TiÃªu chuáº©n'} Â· {availability.trip.bus.name}
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
                      <div className="text-xs uppercase text-gray-400">TÃ¬nh tráº¡ng gháº¿</div>
                      <div className="text-lg font-semibold text-white">
                        {counts.available} trá»‘ng Â· {counts.held} báº¡n giá»¯ Â· {counts.locked} bá»‹ khÃ³a
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Tá»•ng {counts.total} gháº¿ ({counts.inactive} khÃ´ng bÃ¡n)
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

                {selectedSeats.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="text-sm font-semibold text-white">ThÃ´ng tin tá»«ng gháº¿</div>
                    <div className="space-y-3">
                      {selectedSeats.map((code) => {
                        const passenger = passengers.find((p) => p.seatCode === code) || {
                          seatCode: code,
                          name: '',
                        };
                        return (
                          <div
                            key={code}
                            className="grid md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="md:col-span-3 text-sm text-white font-semibold flex items-center gap-2">
                              <span>Gháº¿ {code}</span>
                              <span className="text-xs text-gray-400">
                                GiÃ¡ {availability.seats.find((s) => s.code === code)?.price.toLocaleString() || 'â€”'} Ä‘
                              </span>
                            </div>
                            <FormField
                              label="Há» tÃªn"
                              value={passenger.name}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updatePassenger(code, { name: e.target.value })
                              }
                              className="md:col-span-2"
                            />
                            <FormField
                              label="SÄT"
                              value={passenger.phone || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updatePassenger(code, { phone: e.target.value })
                              }
                            />
                            <FormField
                              label="CCCD/Passport"
                              value={passenger.idNumber || ''}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updatePassenger(code, { idNumber: e.target.value })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase text-emerald-100">Gháº¿ Ä‘Ã£ chá»n</div>
                      <div className="text-xl font-bold text-white">
                        {selectedSeats.length ? selectedSeats.join(', ') : 'ChÆ°a chá»n'}
                      </div>
                      <div className="text-sm text-emerald-50">
                        Tá»•ng tiá»n: <span className="font-semibold">{totalPrice.toLocaleString()} Ä‘</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-200">GiÃ¡ cÆ¡ báº£n</div>
                      <div className="text-lg font-semibold text-white">
                        {availability.trip.basePrice.toLocaleString()} Ä‘
                      </div>
                      <div className="text-xs text-gray-400">GiÃ¡ gháº¿ cÃ³ thá»ƒ cao hÆ¡n</div>
                    </div>
                  </div>

                  {lockInfo ? (
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
                          <span className="text-emerald-200 font-semibold">{seat.price.toLocaleString()} Ä‘</span>
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
