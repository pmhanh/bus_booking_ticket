// src/modules/booking/pages/BookingReviewPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { useBooking } from "../context/BookingContext";
import { useAuth } from "../../auth/context/AuthContext";
import { createBooking } from "../api/bookings";
import { createStripePayment } from "../../payments/api/payments";

export const BookingReviewPage = () => {
  const navigate = useNavigate();
  const { trip, passengers, contact, totalPrice, hold } = useBooking();
  const { accessToken } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard: phải có trip + passengers + hold
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

  // Payload: ép kiểu về string chắc chắn (không undefined)
  const payload = useMemo(() => {
    if (!trip || !hold?.lockToken) return null;

    return {
      tripId: trip.id,
      contactName: contact.name,      // ✅ string
      contactEmail: contact.email,    // ✅ string
      contactPhone: contact.phone,    // ✅ string
      lockToken: hold.lockToken,
      holdExpiresAt: hold.expiresAt,
      passengers: passengers.map((p) => ({
        seatCode: p.seatCode,
        name: p.name,
        phone: p.phone,
        idNumber: p.idNumber,
      })),
    };
  }, [contact.email, contact.name, contact.phone, hold?.lockToken, passengers, trip]);

  const confirmBooking = async () => {
    console.log('CREATE BOOKING PAYLOAD', payload);

    if (!payload) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createBooking(payload, accessToken);
      const stripe = await createStripePayment(
        { bookingId: res.booking.id, email: contact.email },
        accessToken,
      );
      window.location.href = stripe.checkoutUrl;

    } catch (err) {
      setError((err as Error)?.message || "Không thể tạo đặt chỗ.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!trip || !payload) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-gray-200 text-sm">Chưa có thông tin chuyến hoặc ghế được chọn.</Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400">Review booking</p>
          <h1 className="text-3xl font-bold text-white">Xác nhận đặt chỗ</h1>
          <p className="text-sm text-gray-300">Kiểm tra thông tin trước khi tạo vé điện tử.</p>
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
              <div className="text-xs text-gray-400 uppercase">Ghế</div>
              <div className="text-white font-semibold">{passengers.map((p) => p.seatCode).join(", ")}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Xe</div>
              <div className="text-white font-semibold">{trip.bus.name}</div>
            </div>
          </div>
        </Card>

        <Card title="Liên hệ">
          <div className="text-sm text-gray-200 space-y-1">
            <div><span className="text-gray-400">Người liên hệ:</span> <span className="text-white font-semibold">{contact.name}</span></div>
            <div><span className="text-gray-400">Email:</span> <span className="text-white font-semibold">{contact.email}</span></div>
            <div><span className="text-gray-400">SĐT:</span> <span className="text-white font-semibold">{contact.phone}</span></div>

            <div className="pt-3">
              <Button variant="secondary" onClick={() => navigate("/bookings/passengers")}>
                Sửa thông tin
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Hành khách">
        <div className="space-y-2 text-sm text-gray-200">
          {passengers.map((p) => (
            <div key={p.seatCode} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-white font-semibold">Ghế {p.seatCode}</div>
              <div className="text-gray-200">Tên: <span className="text-white font-semibold">{p.name}</span></div>
              <div className="text-gray-200">SĐT: <span className="text-white font-semibold">{p.phone}</span></div>
              <div className="text-gray-200">ID: <span className="text-white font-semibold">{p.idNumber}</span></div>
            </div>
          ))}

          <div className="flex items-center justify-between text-lg text-white font-bold pt-2 border-t border-white/10">
            <span>Tổng thanh toán</span>
            <span>{totalPrice.toLocaleString()} VND</span>
          </div>

          <Button onClick={confirmBooking} disabled={submitting} className="w-full">
            {submitting ? "Đang xử lý..." : "Xác nhận & tạo e-ticket"}
          </Button>
        </div>
      </Card>
    </div>
  );
};
