import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { SeatMapView } from "../components/SeatMapView";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { fetchSeatStatus, holdSeats } from "../api/seats";
import { useBooking } from "../context/BookingContext";
import type { SeatAvailability, SeatWithState } from "../../seatmap/types/seatMap";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/api$/, "");
const HOLD_TTL_SECONDS = 15 * 60;

export const SeatSelectionPage = () => {
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
    initPassengersFromSeats, // ✅ NEW
  } = useBooking();

  const socketRef = useRef<Socket | null>(null);

  const [availability, setAvailability] = useState<SeatAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [holdError, setHoldError] = useState<string | null>(null);
  const [holdRemaining, setHoldRemaining] = useState<number | null>(null);

  const [holding, setHolding] = useState(false);
  const maxSelectable = 4;

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
      setError(null);
      try {
        const data = await fetchSeatStatus(tripId);
        syncAvailability(data);
      } catch (err) {
        setError((err as Error).message || "Không thể tải sơ đồ ghế");
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [syncAvailability, tripId],
  );

  useEffect(() => {
    loadAvailability(true);
  }, [loadAvailability]);

  // Nếu đã hold rồi thì redirect sang passengers
  useEffect(() => {
    if (hold?.tripId === tripId) {
      navigate("/bookings/passengers", { replace: true });
    }
  }, [hold, navigate, tripId]);

  const toggleSeat = useCallback(
    (seat: SeatWithState) => {
      setError(null);

      if (seat.status === "booked" || seat.status === "held") return;
      if (seat.status === "inactive") return;

      const exists = selectedSeats.some((s) => s.code === seat.code);

      if (!exists && selectedSeats.length >= maxSelectable) {
        setError(`Chỉ được chọn tối đa ${maxSelectable} ghế.`);
        return;
      }

      const price = availability?.trip.basePrice ?? 0;

      setSelectedSeats((prev) =>
        exists ? prev.filter((s) => s.code !== seat.code) : [...prev, { code: seat.code, price }],
      );
    },
    [availability?.trip.basePrice, maxSelectable, selectedSeats, setSelectedSeats],
  );

  /** ✅ HOLD khi bấm Tiếp tục + INIT PASSENGERS */
  const holdAndContinue = useCallback(async () => {
    if (!tripId) return;

    if (!selectedSeats.length) {
      setError("Chọn ít nhất 1 ghế trước khi tiếp tục.");
      return;
    }

    setHolding(true);
    setHoldError(null);

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
              ? { ...seat, status: "held", expiresAt: res.expiresAt }
              : seat,
          ),
        };
      });

      const expiresMs = new Date(res.expiresAt).getTime() - Date.now();
      setHoldRemaining(Math.max(0, Math.floor(expiresMs / 1000)));

      // 3) navigate
      navigate("/bookings/passengers");
    } catch (err) {
      setHold(null);
      setHoldRemaining(null);
      setHoldError((err as Error).message || "Giữ ghế thất bại.");
      await loadAvailability(false);
    } finally {
      setHolding(false);
    }
  }, [initPassengersFromSeats, loadAvailability, navigate, selectedSeats, setHold, tripId]);

  /** Countdown giữ ghế */
  useEffect(() => {
    if (!hold) {
      setHoldRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = Math.floor((new Date(hold.expiresAt).getTime() - Date.now()) / 1000);
      const safe = Math.max(0, remaining);
      setHoldRemaining(safe);

      if (remaining <= 0) {
        setHold(null);
        setHoldError("Hết thời gian giữ ghế, vui lòng giữ lại.");
        loadAvailability(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold, loadAvailability, setHold]);

  /** WebSocket realtime */
  useEffect(() => {
    if (!tripId) return;

    const socket = io(`${API_ORIGIN}/ws`, { withCredentials: true });
    socketRef.current = socket;

    socket.emit("joinTrip", { tripId });

    const applyChanges = (changes: { seatCode: string; status: string; expiresAt?: string }[]) => {
      setAvailability((prev) => {
        if (!prev) return prev;

        const map = new Map(changes.map((c) => [c.seatCode, c]));
        return {
          ...prev,
          seats: prev.seats.map((seat) => {
            const change = map.get(seat.code);
            if (!change) return seat;

            let status: SeatWithState["status"] = seat.status;
            if (change.status === "released") status = seat.isActive ? "available" : "inactive";
            else if (change.status === "held") status = "held";
            else if (change.status === "booked") status = "booked";

            return { ...seat, status, expiresAt: change.expiresAt ?? seat.expiresAt };
          }),
        };
      });
    };

    socket.on("seatHeld", (p: { tripId: number; seatCodes: string[]; expiresAt?: string }) => {
      if (p.tripId !== tripId) return;
      applyChanges(p.seatCodes.map((c) => ({ seatCode: c, status: "held", expiresAt: p.expiresAt })));
    });

    socket.on("seatReleased", (p: { tripId: number; seatCodes: string[] }) => {
      if (p.tripId !== tripId) return;
      applyChanges(p.seatCodes.map((c) => ({ seatCode: c, status: "released" })));
    });

    socket.on("seatBooked", (p: { tripId: number; seatCodes: string[] }) => {
      if (p.tripId !== tripId) return;
      applyChanges(p.seatCodes.map((c) => ({ seatCode: c, status: "booked" })));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tripId]);

  const availableCount = useMemo(
    () => availability?.seats.filter((s) => s.status === "available").length ?? 0,
    [availability],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-emerald-200" onClick={() => navigate(-1)}>
            ← Quay lại
          </button>
          <h1 className="text-3xl font-bold text-white">Chọn ghế</h1>
          <p className="text-sm text-gray-300">
            Có thể chọn / bỏ chọn ghế. Ghế chỉ bị giữ khi bấm <b>Tiếp tục</b>.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiết
        </Button>
      </div>

      {error && <Card className="text-red-200 text-sm">{error}</Card>}
      {holdError && <Card className="text-amber-200 text-sm">{holdError}</Card>}

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
                maxSelectable={maxSelectable}
                basePrice={availability.trip.basePrice}
              />

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => loadAvailability(true)}>
                  Làm mới
                </Button>
                <Button onClick={holdAndContinue} disabled={holding || !selectedSeats.length}>
                  {holding ? "Đang giữ ghế…" : "Tiếp tục"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-sm text-gray-300">
                  Ghế trống: <b>{availableCount}</b> / {availability.seats.length}
                </div>
                {holdRemaining !== null && (
                  <div className="text-sm text-amber-200 mt-2">
                    Thời gian giữ:{" "}
                    <b>
                      {Math.floor(holdRemaining / 60)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {(holdRemaining % 60).toString().padStart(2, "0")}
                    </b>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-emerald-500/10 p-4">
                <div className="text-xs text-emerald-100">Ghế đã chọn</div>
                <div className="text-xl text-white font-bold">
                  {selectedSeats.length ? selectedSeats.map((s) => s.code).join(", ") : "Chưa chọn"}
                </div>
                <div className="text-sm text-emerald-50">
                  Tổng tiền: <b>{totalPrice.toLocaleString()} VND</b>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
