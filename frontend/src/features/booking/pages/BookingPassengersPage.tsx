import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { FormField } from "../../../shared/components/ui/FormField";
import { useBooking } from "../context/BookingContext";
import { useAuth } from "../../auth/context/AuthContext";

// ===== Helpers: VN phone + CCCD =====
const normalizePhoneVN = (raw: string) => {
  const s = (raw || "").trim();

  // remove spaces, dots, dashes... keep digits and '+'
  const cleaned = s.replace(/[^\d+]/g, "");

  // +84xxxxxxxxx => 0xxxxxxxxx
  if (cleaned.startsWith("+84")) {
    return "0" + cleaned.slice(3).replace(/[^\d]/g, "");
  }

  // 84xxxxxxxxx (no '+') => 0xxxxxxxxx (optional support)
  if (cleaned.startsWith("84") && cleaned.length >= 11) {
    return "0" + cleaned.slice(2).replace(/[^\d]/g, "");
  }

  // keep digits only
  return cleaned.replace(/[^\d]/g, "");
};

const isVietnamMobilePhone = (raw: string) => {
  const p = normalizePhoneVN(raw);
  // VN mobile commonly: 0 + 9 or 10 digits => total 10 or 11 digits
  return /^0\d{9,10}$/.test(p);
};

const isCCCD12 = (raw: string) => {
  const id = (raw || "").trim().replace(/\s+/g, "");
  return /^\d{12}$/.test(id);
};

export const BookingPassengersPage = () => {
  const navigate = useNavigate();
  const { trip, passengers, hold, updatePassenger, contact, setContact, pickupStopId, setPickupStopId, dropoffStopId, setDropoffStopId, totalPrice } = useBooking();
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [passengerErrors, setPassengerErrors] = useState<
    Record<string, { name?: string; phone?: string; idNumber?: string }>
  >({});
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  useEffect(() => {
    if (!trip || passengers.length === 0) {
      navigate("/search");
      return;
    }
    if (!hold?.lockToken) {
      navigate(`/trips/${trip.id}/select-seats`);
      return;
    }
  }, [hold?.lockToken, navigate, passengers.length, trip]);

  useEffect(() => {
    if (!user) return;
    if (contact.name || contact.email || contact.phone) return;

    setContact({
      name: user.fullName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
  }, [user, contact.name, contact.email, contact.phone, setContact]);

  const validateForms = () => {
    setError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const nextPassengerErrors: Record<string, { name?: string; phone?: string; idNumber?: string }> = {};
    const nextContactErrors: { name?: string; email?: string; phone?: string } = {};
    let ok = true;

    passengers.forEach((p) => {
      const key = p.seatCode || "UNKNOWN";

      // name
      if (!p.name?.trim()) {
        ok = false;
        nextPassengerErrors[key] = { ...(nextPassengerErrors[key] || {}), name: "Nhập họ tên" };
      } else if (p.name.trim().length < 2) {
        ok = false;
        nextPassengerErrors[key] = { ...(nextPassengerErrors[key] || {}), name: "Tên tối thiểu 2 ký tự" };
      }

      // phone VN
      if (!p.phone?.trim()) {
        ok = false;
        nextPassengerErrors[key] = { ...(nextPassengerErrors[key] || {}), phone: "Nhập số điện thoại" };
      } else if (!isVietnamMobilePhone(p.phone)) {
        ok = false;
        nextPassengerErrors[key] = {
          ...(nextPassengerErrors[key] || {}),
          phone: "SĐT VN không hợp lệ (vd: 09xxxxxxxx hoặc 03xxxxxxxxx)",
        };
      }

      // CCCD 12 digits
      if (!p.idNumber?.trim()) {
        ok = false;
        nextPassengerErrors[key] = { ...(nextPassengerErrors[key] || {}), idNumber: "Nhập CCCD" };
      } else if (!isCCCD12(p.idNumber)) {
        ok = false;
        nextPassengerErrors[key] = { ...(nextPassengerErrors[key] || {}), idNumber: "CCCD phải đúng 12 chữ số" };
      }
    });

    // contact
    if (!contact.name?.trim()) {
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
    } else if (!isVietnamMobilePhone(contact.phone)) {
      ok = false;
      nextContactErrors.phone = "SĐT VN không hợp lệ (vd: 09xxxxxxxx hoặc 03xxxxxxxxx)";
    }

    setPassengerErrors(nextPassengerErrors);
    setContactErrors(nextContactErrors);
    if (!ok) setError("Vui lòng điền đủ thông tin bắt buộc.");
    return ok;
  };

  const canContinue = useMemo(
    () => !!trip && !!hold?.lockToken && passengers.length > 0,
    [hold?.lockToken, passengers.length, trip]
  );

  const goReview = () => {
    if (!canContinue) return;
    if (!validateForms()) return;
    navigate("/bookings/review");
  };

  if (!trip) return null;

  const pickupStops = trip.route?.stops?.filter((s: any) => s.type === 'PICKUP') || [];
  const dropoffStops = trip.route?.stops?.filter((s: any) => s.type === 'DROPOFF') || [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Nhập thông tin hành khách</h1>
          <p className="text-sm text-gray-300">Điền thông tin liên hệ & hành khách trước khi review.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
      </div>

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card title="Chuyến đi">
          <div className="flex flex-wrap items-center gap-2 text-white text-lg font-semibold">
            <span>{trip.route.originCity.name}</span>
            <span className="text-gray-500">{"->"}</span>
            <span>{trip.route.destinationCity.name}</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-200 mt-3">
            <div>
              <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
              <div className="text-white font-semibold">{new Date(trip.departureTime).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Ghế đã giữ</div>
              <div className="text-white font-semibold">{passengers.map((p) => p.seatCode).join(", ")}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Xe</div>
              <div className="text-white font-semibold">{trip.bus.name}</div>
            </div>
          </div>
        </Card>

        <Card title="Liên hệ">
          <div className="text-sm text-gray-200 space-y-3">
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
              value={contact.email}
              onChange={(e) => {
                setContact({ email: e.target.value });
                if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
              }}
              required
              error={contactErrors.email}
            />

            <FormField
              label="Số điện thoại"
              value={contact.phone}
              onChange={(e) => {
                setContact({ phone: normalizePhoneVN(e.target.value) });
                if (contactErrors.phone) setContactErrors((prev) => ({ ...prev, phone: undefined }));
              }}
              required
              error={contactErrors.phone}
            />
          </div>
        </Card>
      </div>

      {(pickupStops.length > 0 || dropoffStops.length > 0) && (
        <Card title="Điểm đón/trả">
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-200">
            {pickupStops.length > 0 && (
              <div>
                <label className="block mb-2 font-medium text-gray-300">
                  Điểm đón (tùy chọn)
                </label>
                <select
                  value={pickupStopId ?? ''}
                  onChange={(e) => setPickupStopId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
                >
                  <option value="">Chưa chọn</option>
                  {pickupStops.map((stop: any) => (
                    <option key={stop.id} value={stop.id} style={{ color: '#111' }}>
                      {stop.city.name} (+{stop.estimatedOffsetMinutes} phút)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dropoffStops.length > 0 && (
              <div>
                <label className="block mb-2 font-medium text-gray-300">
                  Điểm trả (tùy chọn)
                </label>
                <select
                  value={dropoffStopId ?? ''}
                  onChange={(e) => setDropoffStopId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
                >
                  <option value="">Chưa chọn</option>
                  {dropoffStops.map((stop: any) => (
                    <option key={stop.id} value={stop.id} style={{ color: '#111' }}>
                      {stop.city.name} (+{stop.estimatedOffsetMinutes} phút)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card title="Hành khách">
        <div className="space-y-3 text-sm text-gray-200">
          {passengers.map((p) => {
            const key = p.seatCode || "UNKNOWN";
            const errs = passengerErrors[key] || {};

            return (
              <div key={key} className="grid md:grid-cols-3 gap-3 border border-white/10 rounded-xl px-3 py-2">
                <div className="md:col-span-3 text-white font-semibold">Ghế {p.seatCode}</div>

                <FormField
                  label="Họ tên"
                  value={p.name || ""}
                  onChange={(e) => {
                    updatePassenger(p.seatCode, { name: e.target.value });
                    if (errs.name) {
                      setPassengerErrors((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || {}), name: undefined },
                      }));
                    }
                  }}
                  required
                  error={errs.name}
                  className="md:col-span-2"
                />

                <FormField
                  label="Số điện thoại"
                  value={p.phone || ""}
                  onChange={(e) => {
                    updatePassenger(p.seatCode, { phone: normalizePhoneVN(e.target.value) });
                    if (errs.phone) {
                      setPassengerErrors((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || {}), phone: undefined },
                      }));
                    }
                  }}
                  required
                  error={errs.phone}
                />

                <FormField
                  label="CCCD/Passport"
                  value={p.idNumber || ""}
                  onChange={(e) => {
                    // CCCD: keep digits only (optional UX)
                    const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                    updatePassenger(p.seatCode, { idNumber: digitsOnly });

                    if (errs.idNumber) {
                      setPassengerErrors((prev) => ({
                        ...prev,
                        [key]: { ...(prev[key] || {}), idNumber: undefined },
                      }));
                    }
                  }}
                  required
                  error={errs.idNumber}
                />
              </div>
            );
          })}

          <div className="flex items-center justify-between text-lg text-white font-bold pt-2 border-t border-white/10">
            <span>Tổng tạm tính</span>
            <span>{totalPrice.toLocaleString()} VND</span>
          </div>

          <Button className="w-full" onClick={goReview}>
            Tiếp tục
          </Button>
        </div>
      </Card>
    </div>
  );
};
