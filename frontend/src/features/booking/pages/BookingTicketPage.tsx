import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { useBooking } from "../context/BookingContext";
import { useAuth } from "../../auth/context/AuthContext";
import type { Booking } from "../types/booking";
import { getBooking } from "../api/bookings";

export const BookingTicketPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { contact } = useBooking();
  const { accessToken } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(
    (location.state as { booking?: Booking })?.booking || null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (booking || !id) return;

    setLoading(true);
    getBooking(id, accessToken, { phone: contact.phone, email: contact.email })
      .then(setBooking)
      .catch((err) => setError(err?.message || "Không thể tải vé điện tử."))
      .finally(() => setLoading(false));
  }, [accessToken, booking, contact.email, contact.phone, id]);

  // ✅ normalize passengers chắc chắn luôn là array
  const passengers = useMemo(() => {
    if (!booking) return [];
    const p = (booking as any).passengers;

    // nếu backend đổi format thành booking.passenger (single) hoặc booking.passengerInfos...
    if (Array.isArray(p)) return p;

    const alt1 = (booking as any).passengerInfos;
    if (Array.isArray(alt1)) return alt1;

    const alt2 = (booking as any).tickets;
    if (Array.isArray(alt2)) return alt2;

    return [];
  }, [booking]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card className="text-gray-200 text-sm">Đang tải e-ticket...</Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-3">
        <Card className="text-red-200 text-sm">{error}</Card>
        <Button variant="secondary" onClick={() => navigate("/bookings")}>
          Quản lý đặt chỗ
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  const { trip } = booking;
  const departure = trip?.departureTime ? new Date(trip.departureTime).toLocaleString() : "";
  const arrival = trip?.arrivalTime ? new Date(trip.arrivalTime).toLocaleString() : "";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            {"<- Quay lai"}
          </Button>
          <div className="space-y-1">
            <p className="text-xs uppercase text-gray-400">E-ticket</p>
            <h1 className="text-3xl font-bold text-white">
              Vé điện tử #{booking.reference || booking.id}
            </h1>
            <p className="text-sm text-gray-300">Hiển thị mã này khi lên xe hoặc tại quầy.</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => window.print()}>In / Lưu PDF</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/80 to-emerald-900/60 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary grid place-items-center text-white font-bold text-lg">
              B1
            </div>
            <div>
              <div className="text-white font-semibold text-lg">BusTicket One</div>
              <div className="text-xs text-gray-400">Vé điện tử • Thanh toán online</div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-300">
            <div>Liên hệ: {booking.contactName}</div>
            <div>{booking.contactPhone}</div>
            <div>{booking.contactEmail || ""}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-0">
          <div className="p-6 space-y-3 border-r border-white/10">
            <div className="flex items-center gap-3 text-white text-xl font-semibold">
              <span>{trip?.route?.originCity?.name || "N/A"}</span>
              <span className="text-gray-500">{"->"}</span>
              <span>{trip?.route?.destinationCity?.name || "N/A"}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-200">
              <InfoBox label="Giờ đi" value={departure || "N/A"} />
              <InfoBox label="Giờ đến dự kiến" value={arrival || "N/A"} />
              <InfoBox label="Xe" value={trip?.bus?.name || "N/A"} sub={trip?.bus?.plateNumber} />
              <InfoBox label="Mã đặt chỗ" value={String(booking.reference || booking.id)} sub={booking.status} />
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs uppercase text-gray-400">Hành khách</div>

              {/* ✅ Map trên passengers đã normalize */}
              <div className="space-y-2">
                {passengers.length === 0 ? (
                  <div className="text-gray-400 text-sm">Không có dữ liệu hành khách.</div>
                ) : (
                  passengers.map((p: any) => {
                    const seatCode = p.seatCode ?? p.seat_code ?? p.seat ?? "N/A";
                    const name = p.name ?? p.passengerName ?? p.passenger_name ?? "Khách";
                    const phone = p.phone ?? p.passengerPhone ?? p.passenger_phone ?? "";
                    const idNumber = p.idNumber ?? p.id_number ?? p.identityNumber ?? "";
                    const price = (p.price ?? p.unitPrice ?? p.amount ?? trip?.basePrice ?? 0) as number;

                    return (
                      <div
                        key={String(seatCode) + String(name)}
                        className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-200/30 px-3 py-2 text-white"
                      >
                        <div>
                          <div className="font-semibold">{name}</div>
                          <div className="text-xs text-gray-300">
                            Ghế {seatCode} · {phone} · {idNumber}
                          </div>
                        </div>
                        <div className="text-emerald-100 font-semibold">{Number(price).toLocaleString()} đ</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4 bg-gradient-to-br from-emerald-900/60 to-slate-900/80">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <div className="h-32 w-full rounded-xl bg-gradient-to-br from-white/10 to-white/5 grid place-items-center text-gray-200 text-sm border border-white/10">
                QR / Barcode
              </div>
              <div className="text-xs text-gray-400 mt-2">Quét tại quầy hoặc lên xe</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span>Tổng tiền</span>
                <span className="text-white font-semibold">{(booking.totalPrice ?? 0).toLocaleString()} đ</span>
              </div>
              <div className="text-xs text-emerald-200">
                Vé hợp lệ khi khớp thông tin liên hệ / mã đặt chỗ. Liên hệ hỗ trợ nếu cần chỉnh sửa.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value, sub }: { label: string; value: string; sub?: string | null }) => (
  <div className="rounded-xl bg-white/5 text-gray-100 border border-white/10 p-3">
    <div className="text-[11px] uppercase text-gray-400">{label}</div>
    <div className="text-base font-semibold text-white">{value}</div>
    {sub ? <div className="text-xs text-emerald-200">{sub}</div> : null}
  </div>
);
