import { BackNavigationLayout } from '../../../shared/components/ui/BackNavigationLayout';
import { useToast } from '../../../shared/providers/ToastProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { SERVER_BASE_URL } from '../../../shared/api/config';
import { SeatMapView } from '../components/SeatMapView';
import { ChangeSeatsButton } from '../components/ChangeSeatsButton';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { fetchSeatStatus, holdSeats } from '../api/seats';
import { useBooking } from '../context/BookingContext';
import {
  isCurrentSeatHold,
  reconcileSelectedSeats,
} from '../utils/reconcileSelectedSeats';
import type {
  SeatAvailability,
  SeatWithState,
} from '../../seatmap/types/seatMap';

const HOLD_TTL_SECONDS = 15 * 60;

export const SeatSelectionPage = () => {
  const { showError } = useToast();
  const { id } = useParams();
  const tripId = Number(id);
  const navigate = useNavigate();

  const {
    setTrip,
    selectedSeats,
    setSelectedSeats,
    totalPrice,
    hold,
    setHold,
    changingSeats,
    resetSelection,
    initPassengersFromSeats, // ✅ NEW
  } = useBooking();

  const socketRef = useRef<Socket | null>(null);

  const [availability, setAvailability] = useState<SeatAvailability | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const [holdRemaining, setHoldRemaining] = useState<number | null>(null);

  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!availability || availability.trip.id !== tripId) return;
    if (
      !holding &&
      hold?.tripId === tripId &&
      !isCurrentSeatHold(hold, tripId, availability.seats)
    ) {
      resetSelection();
      return;
    }
    const ownedCodes =
      hold?.tripId === tripId && new Date(hold.expiresAt).getTime() > Date.now()
        ? hold.seatCodes
        : [];
    setSelectedSeats((selected) =>
      reconcileSelectedSeats(selected, availability.seats, ownedCodes, holding),
    );
  }, [availability, hold, holding, setSelectedSeats, resetSelection, tripId]);

  const syncAvailability = useCallback(
    (data: SeatAvailability) => {
      setAvailability(data);
      setTrip(data.trip);
    },
    [setTrip],
  );

  const loadAvailability = useCallback(
    async (withSpinner = false) => {
      if (!tripId) return;
      if (withSpinner) setLoading(true);

      try {
        const data = await fetchSeatStatus(tripId);
        syncAvailability(data);
      } catch (err) {
        showError((err as Error).message || 'Không thể tải sơ đồ ghế');
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [syncAvailability, tripId, showError],
  );

  useEffect(() => {
    loadAvailability(true);
  }, [loadAvailability]);

  const toggleSeat = useCallback(
    (seat: SeatWithState) => {
      if (holding) return;
      if (seat.status === 'booked' || seat.status === 'held') return;
      if (seat.status === 'inactive') return;

      const price = availability?.trip.basePrice ?? 0;

      setSelectedSeats((prev) =>
        prev.some((s) => s.code === seat.code)
          ? prev.filter((s) => s.code !== seat.code)
          : [...prev, { code: seat.code, price }],
      );
    },
    [availability?.trip.basePrice, holding, setSelectedSeats],
  );

  /** ✅ HOLD khi bấm Tiếp tục + INIT PASSENGERS */
  const holdAndContinue = useCallback(async () => {
    if (!tripId || holding) return;

    if (!selectedSeats.length) {
      showError('Chọn ít nhất 1 ghế trước khi tiếp tục.');
      return;
    }

    setHolding(true);

    try {
      const res = await holdSeats(
        tripId,
        selectedSeats.map((s) => s.code),
        HOLD_TTL_SECONDS,
      );

      // 1) setHold
      setHold({
        lockToken: res.lockToken,
        seatCodes: res.seatCodes,
        expiresAt: res.expiresAt,
        tripId,
      });

      // ✅ 2) initPassengers từ seatCodes (FIX CHÍNH)
      initPassengersFromSeats(res.seatCodes);

      // optimistic update seat status
      setAvailability((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          seats: prev.seats.map((seat) =>
            res.seatCodes.includes(seat.code)
              ? { ...seat, status: 'held', expiresAt: res.expiresAt }
              : seat,
          ),
        };
      });

      const expiresMs = new Date(res.expiresAt).getTime() - Date.now();
      setHoldRemaining(Math.max(0, Math.floor(expiresMs / 1000)));

      // 3) navigate
      navigate('/bookings/passengers');
    } catch (err) {
      setHold(null);
      setHoldRemaining(null);
      showError((err as Error).message || 'Giữ ghế thất bại.');
      await loadAvailability(false);
    } finally {
      setHolding(false);
    }
  }, [
    initPassengersFromSeats,
    holding,
    loadAvailability,
    navigate,
    selectedSeats,
    setHold,
    tripId,
    showError,
  ]);

  /** Countdown giữ ghế */
  useEffect(() => {
    if (!hold) {
      setHoldRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = Math.floor(
        (new Date(hold.expiresAt).getTime() - Date.now()) / 1000,
      );
      const safe = Math.max(0, remaining);
      setHoldRemaining(safe);

      if (remaining <= 0) {
        setHold(null);
        showError('Hết thời gian giữ ghế, vui lòng giữ lại.');
        loadAvailability(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold, loadAvailability, setHold, showError]);

  /** WebSocket realtime */
  useEffect(() => {
    if (!tripId) return;

    const socket = io(`${SERVER_BASE_URL}/ws`, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinTrip', { tripId });
      void loadAvailability(false);
    });

    const applyChanges = (
      changes: { seatCode: string; status: string; expiresAt?: string }[],
    ) => {
      setAvailability((prev) => {
        if (!prev) return prev;

        const map = new Map(changes.map((c) => [c.seatCode, c]));
        return {
          ...prev,
          seats: prev.seats.map((seat) => {
            const change = map.get(seat.code);
            if (!change) return seat;

            let status: SeatWithState['status'] = seat.status;
            if (change.status === 'released')
              status = seat.isActive ? 'available' : 'inactive';
            else if (change.status === 'held') status = 'held';
            else if (change.status === 'booked') status = 'booked';

            return {
              ...seat,
              status,
              expiresAt:
                status === 'held' ? (change.expiresAt ?? seat.expiresAt) : null,
            };
          }),
        };
      });
    };

    socket.on(
      'trip_seats_changed',
      (p: {
        tripId: number;
        changes: { seatCode: string; status: string; expiresAt?: string }[];
      }) => {
        if (p.tripId === tripId) applyChanges(p.changes);
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tripId, loadAvailability]);

  const availableCount = useMemo(
    () =>
      availability?.seats.filter((s) => s.status === 'available').length ?? 0,
    [availability],
  );

  if (
    !loading &&
    availability?.trip.id === tripId &&
    hold &&
    isCurrentSeatHold(hold, tripId, availability.seats)
  ) {
    return (
      <BackNavigationLayout
        onBack={() => navigate(`/trips/${tripId}`)}
        contentClassName="max-w-6xl space-y-5"
      >
        <Card title="Bạn đang giữ ghế cho chuyến này">
          <p className="mb-4 text-sm text-gray-300">
            Ghế đang giữ: {hold.seatCodes.join(', ')}. Bạn có thể tiếp tục nhập
            thông tin hoặc nhả ghế để chọn lại ngay.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={changingSeats}
              onClick={() => navigate('/bookings/passengers')}
            >
              Tiếp tục đặt chỗ
            </Button>
            <ChangeSeatsButton onChanged={() => void loadAvailability(true)} />
          </div>
        </Card>
      </BackNavigationLayout>
    );
  }

  return (
    <BackNavigationLayout
      onBack={() => navigate(-1)}
      contentClassName="max-w-6xl space-y-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Chọn ghế</h1>
          <p className="text-sm text-gray-300">
            Có thể chọn / bỏ chọn ghế. Ghế chỉ bị giữ khi bấm <b>Tiếp tục</b>.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiết
        </Button>
      </div>

      {loading || !availability ? (
        <Card>Đang tải sơ đồ ghế…</Card>
      ) : (
        <Card>
          <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
            <div className="space-y-4">
              <SeatMapView
                seatMap={availability.seatMap}
                seats={availability.seats}
                selected={selectedSeats.map((s) => s.code)}
                onToggle={toggleSeat}
                disabled={holding}
                basePrice={availability.trip.basePrice}
                busType={availability.trip.bus.busType}
              />

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  disabled={holding}
                  onClick={() => loadAvailability(true)}
                >
                  Làm mới
                </Button>
                <Button
                  onClick={holdAndContinue}
                  disabled={holding || !selectedSeats.length}
                >
                  {holding ? 'Đang giữ ghế…' : 'Tiếp tục'}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-sm text-gray-300">
                  Ghế trống: <b>{availableCount}</b> /{' '}
                  {availability.seats.length}
                </div>
                {holdRemaining !== null && (
                  <div className="text-sm text-amber-200 mt-2">
                    Thời gian giữ:{' '}
                    <b>
                      {Math.floor(holdRemaining / 60)
                        .toString()
                        .padStart(2, '0')}
                      :{(holdRemaining % 60).toString().padStart(2, '0')}
                    </b>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-4">
                <div className="text-xs text-emerald-100">Ghế đã chọn</div>
                <div className="text-xl text-white font-bold">
                  {selectedSeats.length
                    ? selectedSeats.map((s) => s.code).join(', ')
                    : 'Chưa chọn'}
                </div>
                <div className="text-sm text-emerald-50">
                  Tổng tiền: <b>{totalPrice.toLocaleString('vi-VN')} VND</b>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </BackNavigationLayout>
  );
};
