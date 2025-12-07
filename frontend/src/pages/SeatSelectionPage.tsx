import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { SeatMapView } from "../components/seats/SeatMapView";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { MessagePopup } from "../components/ui/MessagePopup";
import { fetchSeatAvailability, lockSeats, refreshSeatLock, releaseSeatLock } from "../api/seats";
import { useAuth } from "../context/AuthContext";
import { useBooking } from "../context/BookingContext";
import type { SeatAvailability, SeatWithState } from "../types/seatMap";

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export const SeatSelectionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useAuth();
  const {
    trip,
    setTrip,
    selectedSeats,
    setSelectedSeats,
    passengers,
    updatePassenger,
    contact,
    setContact,
    lockInfo,
    setLockInfo,
    totalPrice,
  } = useBooking();

  const [availability, setAvailability] = useState<SeatAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const syncAvailabilityRef = useRef<(data: SeatAvailability) => void>();
  const lockTokenRef = useRef<string | null>(null);

  const syncAvailability = useCallback(
    (data: SeatAvailability) => {
      setAvailability(data);
      setTrip(data.trip);
      const seatsByCode = new Map(data.seats.map((s) => [s.code, s]));

      if (lockInfo?.token) {
        const held = data.seats.filter((s) => s.lockToken === lockInfo.token);
        if (!held.length) {
          const currentCodes = new Set(selectedSeats.map((s) => s.code));
          const stillThere = data.seats.filter((s) => currentCodes.has(s.code));
          if (!stillThere.length) {
            setLockInfo(null);
            setSelectedSeats([]);
          } else {
            setSelectedSeats(stillThere.map((s) => ({ code: s.code, price: s.price })));
          }
        } else {
          const expires =
            held[0].lockedUntil || data.seats.find((s) => s.lockToken === lockInfo.token)?.lockedUntil;
          setLockInfo({ token: lockInfo.token, expiresAt: expires || lockInfo.expiresAt || null });
          setSelectedSeats(held.map((s) => ({ code: s.code, price: s.price })));
        }
      } else {
        const allowed = new Set(
          data.seats.filter((s) => s.status !== "locked" && s.status !== "inactive").map((s) => s.code),
        );
        const next = selectedSeats
          .filter((s) => allowed.has(s.code))
          .map((s) => ({ code: s.code, price: seatsByCode.get(s.code)?.price ?? s.price }));
        setSelectedSeats(next);
      }
    },
    [lockInfo, selectedSeats, setLockInfo, setSelectedSeats, setTrip],
  );

  useEffect(() => {
    syncAvailabilityRef.current = syncAvailability;
  }, [syncAvailability]);

  const loadAvailability = useCallback(
    async (withSpinner = false) => {
      if (!id) return;
      if (withSpinner) setLoading(true);
      setError(null);
      try {
        const data = await fetchSeatAvailability(Number(id), lockTokenRef.current || undefined);
        (syncAvailabilityRef.current || syncAvailability)(data);
      } catch (err) {
        setError((err as Error).message || "Khong the tai so do ghe");
      } finally {
        if (withSpinner) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    loadAvailability(true);
  }, [loadAvailability]);

  useEffect(() => {
    lockTokenRef.current = lockInfo?.token ?? null;
  }, [lockInfo?.token]);

  useEffect(() => {
    if (!id) return;
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3000/api";
    const socketUrl = apiBase.replace(/\/api$/, "");
    const socket = io(`${socketUrl}/seat-updates`, { query: { tripId: id } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConnected(true);
      socket.emit("subscribe", { tripId: Number(id), lockToken: lockTokenRef.current || undefined });
    });
    socket.on("disconnect", () => {
      setWsConnected(false);
    });
    socket.on("connect_error", () => {
      setWsConnected(false);
      setError("Không thể kết nối realtime, đang dùng cập nhật định kỳ.");
    });
    socket.on("seatAvailability", (payload: SeatAvailability) => {
      syncAvailabilityRef.current?.(payload);
    });

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (!socketRef.current || !socketRef.current.connected || !id) return;
    socketRef.current.emit("subscribe", { tripId: Number(id), lockToken: lockInfo?.token });
  }, [id, lockInfo?.token]);

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

  useEffect(() => {
    if (!user) return;
    if (!contact.name) setContact({ name: user.fullName || user.email || "Nguoi dung" });
    if (!contact.email && user.email) setContact({ email: user.email });
    if (!contact.phone && user.phone) setContact({ phone: user.phone });
  }, [user, contact.email, contact.name, contact.phone, setContact]);

  const remainingSeconds = useMemo(() => {
    if (!lockInfo?.expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(lockInfo.expiresAt).getTime() - now) / 1000));
  }, [lockInfo, now]);

  const applyLock = useCallback(
    async (nextSeats: { code: string; price?: number }[]) => {
      if (!id) return;
      if (nextSeats.length === 0) {
        setSelectedSeats([]);
        if (lockInfo) {
          setActionLoading(true);
          try {
            const res = await releaseSeatLock(Number(id), lockInfo.token, accessToken || undefined);
            setAvailability(res.availability);
          } catch {
          } finally {
            setLockInfo(null);
            setActionLoading(false);
          }
        }
        return;
      }

      setActionLoading(true);
      setError(null);
      try {
        const res = await lockSeats(
          Number(id),
          { seats: nextSeats.map((s) => s.code), lockToken: lockInfo?.token },
          accessToken || undefined,
        );
        setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
        setAvailability(res.availability);
        const held = res.availability.seats
          .filter((s) => s.lockToken === res.lockToken)
          .map((s) => ({ code: s.code, price: s.price }));
        setSelectedSeats(held);
      } catch (err) {
        setError((err as Error).message || "Không thể giữ ghế.");
      } finally {
        setActionLoading(false);
      }
    },
    [accessToken, id, lockInfo, setLockInfo, setSelectedSeats],
  );

  const toggleSeat = async (seat: SeatWithState) => {
    if (seat.status === "locked" || seat.status === "inactive") return;
    const exists = selectedSeats.some((s) => s.code === seat.code);
    const seatPrice = seat.price ?? availability?.trip.basePrice ?? 0;
    const next = exists
      ? selectedSeats.filter((s) => s.code !== seat.code)
      : [...selectedSeats, { code: seat.code, price: seatPrice }];
    await applyLock(next);
  };

  const handleRefreshHold = async () => {
    if (!id || !lockInfo || !accessToken) return;
    setActionLoading(true);
    try {
      const res = await refreshSeatLock(Number(id), lockInfo.token, accessToken);
      setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
      setAvailability(res.availability);
    } catch (err) {
      setError((err as Error).message || "Không thể gia hạn giữ ghế.");
    } finally {
      setActionLoading(false);
    }
  };

  const contactRequired = true;
  const contactOk = contact.name.trim() && contact.email?.trim();
  const readyToReview =
    selectedSeats.length > 0 && passengers.every((p) => p.name.trim()) && (contactRequired ? contactOk : !!contact.email);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {"<- Quay lại"}
          </button>
          <h1 className="text-3xl font-bold text-white">Chọn ghế & đặt vé</h1>
          <p className="text-sm text-gray-300">
            Chọn ghế, giữ ghế và điền thông tin hành khách. Khách vãng lai cần bổ sung thông tin liên hệ trước khi xác nhận.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/trips/${id}`)}>
          Xem chi tiết chuyến
        </Button>
      </div>

      <MessagePopup open={!!error} message={error || ""} type="error" onClose={() => setError(null)} />

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
                    {availability.trip.route.originCity.name} {"->"} {availability.trip.route.destinationCity.name}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {availability.seatMap.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(availability.trip.departureTime)} luc {formatTime(availability.trip.departureTime)} khoi hanh
                  </span>
                  <span className="text-xs text-gray-400">
                    Loai xe: {availability.trip.bus.busType || "Tieu chuan"} - {availability.trip.bus.name}
                  </span>
                </div>

                <SeatMapView
                  seatMap={availability.seatMap}
                  seats={availability.seats}
                  selected={selectedSeats.map((s) => s.code)}
                  onToggle={toggleSeat}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase text-gray-400">Trạng thái ghế</div>
                      <div className="text-lg font-semibold text-white">
                        {availability.seats.filter((s) => s.status === "available").length} trong số {availability.seats.length}
                      </div>
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
                    <div className="text-sm font-semibold text-white">Thông tin hành khách</div>
                    <div className="space-y-3">
                      {selectedSeats.map((seat) => {
                        const passenger = passengers.find((p) => p.seatCode === seat.code) || {
                          seatCode: seat.code,
                          name: "",
                        };
                        return (
                          <div
                            key={seat.code}
                            className="grid md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="md:col-span-3 text-sm text-white font-semibold flex items-center gap-2">
                              <span>Ghế {seat.code}</span>
                              <span className="text-xs text-gray-400">
                                Giá {availability.seats.find((s) => s.code === seat.code)?.price.toLocaleString() || ""} VND
                              </span>
                            </div>
                            <FormField
                              label="Họ tên"
                              value={passenger.name}
                              onChange={(e) => updatePassenger(seat.code, { name: e.target.value })}
                              className="md:col-span-2"
                              required
                            />
                            <FormField
                              label="Số điện thoại"
                              value={passenger.phone || ""}
                              onChange={(e) => updatePassenger(seat.code, { phone: e.target.value })}
                              required
                            />
                            <FormField
                              label="CCCD/Passport"
                              value={passenger.idNumber || ""}
                              onChange={(e) => updatePassenger(seat.code, { idNumber: e.target.value })}
                              required
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

                  {lockInfo ? (
                    <div className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-50 flex items-center justify-between">
                      <div>
                        Giờ đến: {new Date(lockInfo.expiresAt || "").toLocaleTimeString()} - còn {Math.floor(remainingSeconds / 60)}:
                        {(remainingSeconds % 60).toString().padStart(2, "0")}
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
                    <div className="text-xs text-gray-300">Chọn ghế để tự động giữ (yêu cầu đăng nhập để giữ).</div>
                  )}

                  <div className="border-t border-white/10 pt-3 space-y-3 text-sm text-gray-200">
                    <div className="space-y-2">
                      <div className="text-xs uppercase text-gray-400">Thông tin liên hệ</div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <FormField
                          label="Người liên hệ"
                          value={contact.name}
                          onChange={(e) => setContact({ name: e.target.value })}
                          required
                        />
                        <FormField
                          label="Email"
                          type="email"
                          value={contact.email || ""}
                          onChange={(e) => setContact({ email: e.target.value })}
                          required
                        />
                        <FormField
                          label="So dien thoai"
                          value={contact.phone || ""}
                          onChange={(e) => setContact({ phone: e.target.value })}
                          required
                        />
                      </div>
                      <div className="text-xs text-gray-400">
                        {user
                          ? "Đã điền sẵn từ tài khoản, bạn có thể chỉnh sửa trước khi xác nhận."
                          : "Cần điền tên và email (bắt buộc) và số điện thoại nếu có để nhận vé."}
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate("/bookings/review", { state: { fromTrip: id } })}
                      disabled={!readyToReview}
                      className="w-full"
                    >
                      Tiếp tục xác nhận
                    </Button>
                    {!readyToReview ? (
                      <div className="text-xs text-gray-400 text-center">
                        Chọn ghế, điền tên hành khách và thông tin liên hệ (nếu cần) để tiếp tục.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
