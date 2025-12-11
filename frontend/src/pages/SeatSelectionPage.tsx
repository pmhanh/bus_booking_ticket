import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SeatMapView } from "../components/seats/SeatMapView";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
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
  const [passengerErrors, setPassengerErrors] = useState<Record<string, { name?: string; phone?: string; idNumber?: string }>>({});
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [guestSessionId] = useState(() => {
    const key = 'guest_session_id';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  });
  const maxSelectable = 4;
  const holdMinutes =
    Number((import.meta.env.VITE_SEAT_HOLD_MINUTES as string | undefined) || 10) || 10;
  const syncAvailabilityRef = useRef<(data: SeatAvailability) => void>();
  const lockTokenRef = useRef<string | null>(null);
  const skipReleaseRef = useRef(false);

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
          data.seats
            .filter((s) => s.status !== "locked" && s.status !== "inactive" && s.status !== "booked")
            .map((s) => s.code),
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

  // realtime updates removed

  useEffect(() => {
    if (!lockInfo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockInfo]);

  useEffect(() => {
    return () => {
      if (skipReleaseRef.current) return;
      if (lockInfo && id) {
        releaseSeatLock(
          Number(id),
          lockInfo.token,
          accessToken || undefined,
          guestSessionId,
        ).catch(() => {});
      }
    };
  }, [lockInfo, accessToken, id, guestSessionId]);

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

  useEffect(() => {
    if (!lockInfo) return;
    if (remainingSeconds > 0) return;
    setError("Phiên giữ ghế hết hạn, vui lòng quay lại chọn ghế và giữ ghế lại.");
    setExpiryModalOpen(true);
    setLockInfo(null);
    setSelectedSeats([]);
    loadAvailability(false);
  }, [lockInfo, remainingSeconds, loadAvailability, setLockInfo, setSelectedSeats]);

  const applyLock = useCallback(
    async (nextSeats: { code: string; price?: number }[]) => {
      if (!id) return;
      if (nextSeats.length === 0) {
        setSelectedSeats([]);
        if (lockInfo) {
          setActionLoading(true);
          try {
            const res = await releaseSeatLock(
              Number(id),
              lockInfo.token,
              accessToken || undefined,
              guestSessionId,
            );
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
        const attempt = async (token?: string) =>
          lockSeats(
            Number(id),
            {
              seats: nextSeats.map((s) => s.code),
              lockToken: token,
              guestSessionId,
              holdMinutes,
            },
            accessToken || undefined,
          );

        const res = await attempt(lockInfo?.token);
        setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
        setAvailability(res.availability);
        const held = res.availability.seats
          .filter((s) => s.lockToken === res.lockToken)
          .map((s) => ({ code: s.code, price: s.price }));
        setSelectedSeats(held);
      } catch (err) {
        const message = (err as Error).message || "Khong the giu ghe.";
        const lower = message.toLowerCase();
        if (lower.includes("lock token") || lower.includes("not found")) {
          try {
            const res = await lockSeats(
              Number(id),
              { seats: nextSeats.map((s) => s.code), guestSessionId, holdMinutes },
              accessToken || undefined,
            );
            setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
            setAvailability(res.availability);
            const held = res.availability.seats
              .filter((s) => s.lockToken === res.lockToken)
              .map((s) => ({ code: s.code, price: s.price }));
            setSelectedSeats(held);
            return;
          } catch (retryErr) {
            setLockInfo(null);
            setSelectedSeats([]);
            loadAvailability(true);
            setError(
              (retryErr as Error).message ||
                "Phiên giữ ghế hết hạn, vui lòng quay lại chọn ghế và giữ ghế lại.",
            );
          }
        }
        setError(message);
      } finally {
        setActionLoading(false);
      }
    },
    [accessToken, guestSessionId, id, loadAvailability, lockInfo, setLockInfo, setSelectedSeats],
  );

    const toggleSeat = async (seat: SeatWithState) => {
    if (seat.status === "locked" || seat.status === "inactive" || seat.status === "booked") return;
    const exists = selectedSeats.some((s) => s.code === seat.code);
    if (!exists && selectedSeats.length >= maxSelectable) {
      setError(`Chi duoc chon toi da ${maxSelectable} ghe trong moi luot dat.`);
      return;
    }
    const seatPrice = seat.price ?? availability?.trip.basePrice ?? 0;
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
    await applyLock(next);
  };

  const handleRefreshHold = async () => {
    if (!id || !lockInfo || !accessToken) return;
    setActionLoading(true);
    try {
      const res = await refreshSeatLock(
        Number(id),
        lockInfo.token,
        accessToken,
        holdMinutes,
        guestSessionId,
      );
      setLockInfo({ token: res.lockToken, expiresAt: res.expiresAt });
      setAvailability(res.availability);
    } catch (err) {
      setError((err as Error).message || "Không thể gia hạn giữ ghế.");
    } finally {
      setActionLoading(false);
    }
  };

  const validateForms = () => {
    const phoneRegex = /^[0-9]{9,11}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nextPassengerErrors: Record<string, { name?: string; phone?: string; idNumber?: string }> = {};
    let ok = true;
    if (!selectedSeats.length) {
      ok = false;
      setError('Vui long chon ghe truoc khi tiep tuc.');
    }
    selectedSeats.forEach((seat) => {
      const p = passengers.find((item) => item.seatCode === seat.code);
      if (!p || !p.name.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), name: "Vui long nhap ho ten" };
      } else if (p.name.trim().length < 2) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), name: "Ten it nhat 2 ky tu" };
      }
      if (!p || !p.phone?.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), phone: "Nhap so dien thoai" };
      } else if (!phoneRegex.test(p.phone.trim())) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), phone: "So dien thoai khong hop le" };
      }
      if (!p || !p.idNumber?.trim()) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), idNumber: "Nhap CCCD/Passport" };
      } else if (p.idNumber.trim().length < 6) {
        ok = false;
        nextPassengerErrors[seat.code] = { ...(nextPassengerErrors[seat.code] || {}), idNumber: "ID it nhat 6 ky tu" };
      }
    });

    const nextContactErrors: { name?: string; email?: string; phone?: string } = {};
    if (!contact.name.trim()) {
      ok = false;
      nextContactErrors.name = "Nhap ten lien he";
    }
    if (!contact.email?.trim()) {
      ok = false;
      nextContactErrors.email = "Nhap email";
    } else if (!emailRegex.test(contact.email.trim())) {
      ok = false;
      nextContactErrors.email = "Email khong hop le";
    }
    if (!contact.phone?.trim()) {
      ok = false;
      nextContactErrors.phone = "Nhap so dien thoai lien he";
    } else if (!phoneRegex.test(contact.phone.trim())) {
      ok = false;
      nextContactErrors.phone = "So dien thoai khong hop le";
    }

    setPassengerErrors(nextPassengerErrors);
    setContactErrors(nextContactErrors);
    if (!ok) setError("Vui long dien du thong tin bat buoc.");
    return ok;
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
                  maxSelectable={maxSelectable}
                  activeLockToken={lockInfo?.token || undefined}
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
                        const errs = passengerErrors[seat.code] || {};
                        return (
                          <div
                            key={seat.code}
                            className="grid md:grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="md:col-span-3 text-sm text-white font-semibold flex items-center gap-2">
                              <span>Ghế {seat.code}</span>
                              <span className="text-xs text-gray-400">
                                 {availability.seats.find((s) => s.code === seat.code)?.price.toLocaleString() || ""} VND
                              </span>
                            </div>
                            <FormField
                              label="Họ tên"
                              value={passenger.name}
                              onChange={(e) => {
                                updatePassenger(seat.code, { name: e.target.value });
                                if (errs.name) setPassengerErrors((prev) => ({ ...prev, [seat.code]: { ...(prev[seat.code] || {}), name: undefined } }));
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
                                if (errs.phone) setPassengerErrors((prev) => ({ ...prev, [seat.code]: { ...(prev[seat.code] || {}), phone: undefined } }));
                              }}
                              required
                              error={errs.phone}
                            />
                            <FormField
                              label="CCCD/Passport"
                              value={passenger.idNumber || ""}
                              onChange={(e) => {
                                updatePassenger(seat.code, { idNumber: e.target.value });
                                if (errs.idNumber) setPassengerErrors((prev) => ({ ...prev, [seat.code]: { ...(prev[seat.code] || {}), idNumber: undefined } }));
                              }}
                              required
                              error={errs.idNumber}
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
                          label="So dien thoai"
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
                        skipReleaseRef.current = true;
                        if (validateForms()) {
                          navigate("/bookings/review", { state: { fromTrip: id } });
                        } else {
                          skipReleaseRef.current = false;
                        }
                      }}
                      disabled={actionLoading}
                      className="w-full"
                    >
                      Tiếp tục xác nhận
                    </Button>
                    
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {expiryModalOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl p-5 space-y-4">
            <div className="text-lg font-semibold text-white">Phiên giữ ghế hết hạn</div>
            <div className="text-sm text-gray-200">
              Phiên giữ ghế hết hạn, vui lòng quay lại chọn ghế và giữ ghế lại.
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setExpiryModalOpen(false)}
                className="border border-white/10 bg-white/10"
              >
                Đóng
              </Button>
              <Button
                onClick={() => {
                  setExpiryModalOpen(false);
                  loadAvailability(true);
                }}
              >
                Chọn ghế lại
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
