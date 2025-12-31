import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { SeatMapView } from "../components/SeatMapView";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { FormField } from "../../../shared/components/ui/FormField";
import { fetchSeatStatus, holdSeats, releaseSeats } from "../api/seats";
import { useAuth } from "../../auth/context/AuthContext";
import { useBooking } from "../context/BookingContext";
import type { SeatAvailability, SeatWithState } from "../types/seatMap";

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/api$/, "");
const HOLD_TTL_SECONDS = 120;

export const SeatSelectionPage = () => {
  const { id } = useParams();
  const tripId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    setTrip,
    selectedSeats,
    setSelectedSeats,
    passengers,
    updatePassenger,
    contact,
    setContact,
    totalPrice,
    hold,
    setHold,
  } = useBooking();

  const socketRef = useRef<Socket | null>(null);
  const [availability, setAvailability] = useState<SeatAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [holdRemaining, setHoldRemaining] = useState<number | null>(null);
  const [passengerErrors, setPassengerErrors] = useState<
    Record<string, { name?: string; phone?: string; idNumber?: string }>
  >({});
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const maxSelectable = 4;

  const sanitizeSelection = useCallback(
    (data: SeatAvailability) => {
      const seatsByCode = new Map(data.seats.map((s) => [s.code, s]));
      const allowed = new Set(
        data.seats
          .filter((s) => s.status === "available" || (!!hold && hold.seatCodes.includes(s.code)))
          .map((s) => s.code),
      );
      const next = selectedSeats
        .filter((s) => allowed.has(s.code))
        .map((s) => ({ code: s.code, price: seatsByCode.get(s.code)?.price ?? s.price }));
      if (next.length !== selectedSeats.length) {
        setSelectedSeats(next);
      }
    },
    [hold, selectedSeats, setSelectedSeats],
  );

  const syncAvailability = useCallback(
    (data: SeatAvailability) => {
      setAvailability(data);
      setTrip(data.trip);
      sanitizeSelection(data);
    },
    [sanitizeSelection, setTrip],
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

  useEffect(() => {
    if (!user) return;
    if (!contact.name) setContact({ name: user.fullName || user.email || "Người dùng" });
    if (!contact.email && user.email) setContact({ email: user.email });
    if (!contact.phone && user.phone) setContact({ phone: user.phone });
  }, [user, contact.email, contact.name, contact.phone, setContact]);

  const releaseHold = useCallback(
    async (reason?: string) => {
      if (!hold || !tripId) return;
      setHold(null);
      try {
        await releaseSeats(tripId, hold.seatCodes, hold.lockToken);
      } catch {
        // best-effort
      } finally {
        if (reason) {
          setError(reason);
        }
      }
    },
    [hold, setHold, tripId],
  );

  const toggleSeat = useCallback(
    async (seat: SeatWithState) => {
      if (seat.status !== "available") return;
      if (hold) {
        await releaseHold("Đã thay đổi ghế, vui lòng giữ lại.");
      }
      const exists = selectedSeats.some((s) => s.code === seat.code);
      if (!exists && selectedSeats.length >= maxSelectable) {
        setError(`Chỉ được chọn tối đa ${maxSelectable} ghế trong mỗi lượt đặt.`);
        return;
      }
      const seatPrice = availability?.trip.basePrice ?? 0;
      const next = exists
        ? selectedSeats.filter((s) => s.code !== seat.code)
        : [...selectedSeats, { code: seat.code, price: seatPrice }];
      if (!exists) {
        setPassengerErrors((prev) => {
          const copy = { ...prev };
          delete copy[seat.code];
          return copy;
        });
      }
      setSelectedSeats(next);
      setHoldError(null);
      setError(null);
    },
    [availability?.trip.basePrice, hold, maxSelectable, releaseHold, selectedSeats, setSelectedSeats],
  );

  const handleHold = useCallback(async () => {
    if (!tripId) return;
    if (!selectedSeats.length) {
      setError("Chọn ít nhất 1 ghế trước khi giữ.");
      return;
    }
    if (hold && hold.seatCodes.join(",") === selectedSeats.map((s) => s.code).join(",")) {
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
      setHold({
        lockToken: res.lockToken,
        seatCodes: res.seatCodes,
        expiresAt: res.expiresAt,
        tripId,
      });
      const expiresMs = new Date(res.expiresAt).getTime() - Date.now();
      setHoldRemaining(Math.max(0, Math.floor(expiresMs / 1000)));

      // Optimistic seat state to held
      setAvailability((prev) => {
        if (!prev) return prev;
        const nextSeats = prev.seats.map((seat) =>
          res.seatCodes.includes(seat.code)
            ? { ...seat, status: "held" as const, expiresAt: res.expiresAt }
            : seat,
        );
        const next = { ...prev, seats: nextSeats };
        sanitizeSelection(next);
        return next;
      });
    } catch (err) {
      setHold(null);
      setHoldRemaining(null);
      setHoldError((err as Error).message || "Giữ ghế thất bại, vui lòng thử lại.");
      await loadAvailability(false);
    } finally {
      setHolding(false);
    }
  }, [hold, loadAvailability, sanitizeSelection, selectedSeats, setHold, tripId]);

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

  // Poll status periodically to stay in sync even if no socket event
  useEffect(() => {
    if (!tripId) return;
    const interval = setInterval(() => loadAvailability(false), 15000);
    return () => clearInterval(interval);
  }, [loadAvailability, tripId]);

  useEffect(() => {
    if (!tripId) return;
    const socket = io(`${API_ORIGIN}/ws`, { withCredentials: true });
    socketRef.current = socket;
    socket.emit("join_trip", { tripId });

    socket.on("trip_seats_changed", (payload: { tripId: number; changes: { seatCode: string; status: string; expiresAt?: string }[] }) => {
      if (payload.tripId !== tripId) return;
      setAvailability((prev) => {
        if (!prev) return prev;
        const changeMap = new Map(payload.changes.map((c) => [c.seatCode, c]));
        const nextSeats = prev.seats.map((seat) => {
          const change = changeMap.get(seat.code);
          if (!change) return seat;
          let status: SeatWithState["status"] = seat.status;
          if (change.status === "released") status = seat.isActive ? "available" : "inactive";
          else if (change.status === "held") status = "held";
          else if (change.status === "booked") status = "booked";
          return { ...seat, status, expiresAt: change.expiresAt ?? seat.expiresAt };
        });
        const next = { ...prev, seats: nextSeats };
        sanitizeSelection(next);
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sanitizeSelection, tripId]);

  useEffect(() => {
    return () => {
      releaseHold();
      socketRef.current?.disconnect();
    };
  }, [releaseHold]);

  const validateForms = () => {
    const phoneRegex = /^[0-9]{9,11}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nextPassengerErrors: Record<string, { name?: string; phone?: string; idNumber?: string }> = {};
    let ok = true;
    if (!selectedSeats.length) {
      ok = false;
      setError("Vui lòng chọn ghế trước khi tiếp tục.");
    }
    selectedSeats.forEach((seat) => {
      const p = passengers.find((item) => item.seatCode === seat.code);
      if (!p || !p.name?.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), name: "Vui lòng nhập họ tên" };
      } else if (p.name.trim().length < 2) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), name: "Tên ít nhất 2 ký tự" };
      }
      if (!p || !p.phone?.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), phone: "Nhập số điện thoại" };
      } else if (!phoneRegex.test(p.phone.trim())) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), phone: "Số điện thoại không hợp lệ" };
      }
      if (!p || !p.idNumber?.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), idNumber: "Nhập CCCD/Passport" };
      } else if (p.idNumber.trim().length < 6) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), idNumber: "ID ít nhất 6 ký tự" };
      }
    });

    const nextContactErrors: { name?: string; email?: string; phone?: string } = {};
    if (!contact.name.trim()) {
      ok = false;
      nextContactErrors.name = "Nhập tên liên hệ";
    }
    if (!contact.email?.trim()) {
      ok = false;
      nextContactErrors.email = "Nhập email";
    } else if (!emailRegex.test(contact.email.trim())) {
      ok = false;
      nextContactErrors.email = "Email không hợp lệ";
    }
    if (!contact.phone?.trim()) {
      ok = false;
      nextContactErrors.phone = "Nhập số điện thoại liên hệ";
    } else if (!phoneRegex.test(contact.phone.trim())) {
      ok = false;
      nextContactErrors.phone = "Số điện thoại không hợp lệ";
    }

    setPassengerErrors(nextPassengerErrors);
    setContactErrors(nextContactErrors);
    if (!ok) setError("Vui lòng điền đủ thông tin bắt buộc.");
    return ok;
  };

  const availableCount = useMemo(
    () => availability?.seats.filter((s) => s.status === "available").length ?? 0,
    [availability?.seats],
  );

  const canContinue = hold && holdRemaining !== null && holdRemaining > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {"<- Quay lại"}
          </button>
          <h1 className="text-3xl font-bold text-white">Chọn ghế & giữ chỗ</h1>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiết chuyến
        </Button>
      </div>

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}
      {holdError ? <Card className="text-amber-200 text-sm">{holdError}</Card> : null}

      {loading || !availability ? (
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-white/10 rounded w-1/3" />
            <div className="h-48 bg-white/5 rounded-xl" />
          </div>
        </Card>
      ) : (
        <Card>
          <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-200">
                <span className="text-lg font-semibold text-white">
                  {availability.trip.route.originCity.name} {"->"} {availability.trip.route.destinationCity.name}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                  {availability.seatMap.name}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(availability.trip.departureTime)} lúc {formatTime(availability.trip.departureTime)} khởi hành
                </span>
                <span className="text-xs text-gray-400">
                  Loại xe: {availability.trip.bus.busType || "Tiêu chuẩn"} - {availability.trip.bus.name}
                </span>
              </div>

              <SeatMapView
                seatMap={availability.seatMap}
                seats={availability.seats}
                selected={selectedSeats.map((s) => s.code)}
                onToggle={toggleSeat}
                maxSelectable={maxSelectable}
                basePrice={availability.trip.basePrice}
              />

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => loadAvailability(true)}>
                  Làm mới trạng thái
                </Button>
                <Button onClick={handleHold} disabled={holding || !selectedSeats.length}>
                  {holding ? "Đang giữ ghế..." : "Giữ ghế trong 2 phút"}
                </Button>
                {hold ? (
                  <Button variant="secondary" onClick={() => releaseHold("Đã hủy giữ ghế.")}>
                    Bỏ giữ ghế
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-gray-400">Trạng thái ghế</div>
                    <div className="text-lg font-semibold text-white">
                      {availableCount} trong số {availability.seats.length}
                    </div>
                  </div>
                  {holdRemaining !== null ? (
                    <div className="text-right text-sm text-amber-100">
                      Giữ ghế còn:{" "}
                      <span className="font-semibold text-white">
                        {Math.floor(holdRemaining / 60)
                          .toString()
                          .padStart(2, "0")}
                        :
                        {(holdRemaining % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                  ) : null}
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
                      {selectedSeats.length ? selectedSeats.map((s) => s.code).join(", ") : "Chưa chọn"}
                    </div>
                    <div className="text-sm text-emerald-50">
                      Tổng tiền: <span className="font-semibold">{totalPrice.toLocaleString()} VND</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-200">Giá cơ bản</div>
                    <div className="text-lg font-semibold text-white">
                      {availability.trip.basePrice.toLocaleString()} VND
                    </div>
                    <div className="text-xs text-gray-400">Giá có thể khác theo ghế</div>
                  </div>
                </div>

                <div className="text-xs text-gray-300">
                  Bắt buộc giữ ghế trước khi nhập thông tin hành khách. Hết thời gian giữ sẽ cần thực hiện lại.
                </div>
              </div>

              {hold && holdRemaining && holdRemaining > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="text-sm font-semibold text-white">Thông tin hành khách</div>
                  <div className="space-y-3">
                    {selectedSeats.map((seat) => {
                      const passenger = passengers.find((p) => p.seatCode === seat.code) || {
                        seatCode: seat.code,
                        name: "",
                      };
                      const errs = passengerErrors[seat.code] || {};
                      return (
                        <div
                          key={seat.code}
                          className="grid md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="md:col-span-3 text-sm text-white font-semibold flex items-center gap-2">
                            <span>Ghế {seat.code}</span>
                            <span className="text-xs text-gray-400">
                               {availability.trip.basePrice.toLocaleString()} VND
                            </span>
                          </div>
                          <FormField
                            label="Họ tên"
                            value={passenger.name}
                            onChange={(e) => {
                              updatePassenger(seat.code, { name: e.target.value });
                              if (errs.name)
                                setPassengerErrors((prev) => ({
                                  ...prev,
                                  [seat.code]: { ...(prev[seat.code] || {}), name: undefined },
                                }));
                            }}
                            className="md:col-span-2"
                            required
                            error={errs.name}
                          />
                          <FormField
                            label="Số điện thoại"
                            value={passenger.phone || ""}
                            onChange={(e) => {
                              updatePassenger(seat.code, { phone: e.target.value });
                              if (errs.phone)
                                setPassengerErrors((prev) => ({
                                  ...prev,
                                  [seat.code]: { ...(prev[seat.code] || {}), phone: undefined },
                                }));
                            }}
                            required
                            error={errs.phone}
                          />
                          <FormField
                            label="CCCD/Passport"
                            value={passenger.idNumber || ""}
                            onChange={(e) => {
                              updatePassenger(seat.code, { idNumber: e.target.value });
                              if (errs.idNumber)
                                setPassengerErrors((prev) => ({
                                  ...prev,
                                  [seat.code]: { ...(prev[seat.code] || {}), idNumber: undefined },
                                }));
                            }}
                            required
                            error={errs.idNumber}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-3 text-sm text-gray-200">
                    <div className="space-y-2">
                      <div className="text-xs uppercase text-gray-400">Thông tin liên hệ</div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <FormField
                          label="Người liên hệ"
                          value={contact.name}
                          onChange={(e) => {
                            setContact({ name: e.target.value });
                            if (contactErrors.name) setContactErrors((prev) => ({ ...prev, name: undefined }));
                          }}
                          required
                          error={contactErrors.name}
                        />
                        <FormField
                          label="Email"
                          type="email"
                          value={contact.email || ""}
                          onChange={(e) => {
                            setContact({ email: e.target.value });
                            if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
                          }}
                          required
                          error={contactErrors.email}
                        />
                        <FormField
                          label="Số điện thoại"
                          value={contact.phone || ""}
                          onChange={(e) => {
                            setContact({ phone: e.target.value });
                            if (contactErrors.phone) setContactErrors((prev) => ({ ...prev, phone: undefined }));
                          }}
                          required
                          error={contactErrors.phone}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        if (!canContinue) {
                          setHoldError("Bạn cần giữ ghế trước khi tiếp tục.");
                          return;
                        }
                        if (validateForms()) {
                          navigate("/bookings/review", { state: { fromTrip: id } });
                        }
                      }}
                      className="w-full"
                      disabled={!canContinue}
                    >
                      Tiếp tục xác nhận
                    </Button>
                  </div>
                </div>
              ) : (
                <Card className="text-sm text-gray-200 border-dashed border-white/20 bg-white/5">
                  Giữ ghế để nhập thông tin hành khách và tiếp tục đặt vé.
                </Card>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
