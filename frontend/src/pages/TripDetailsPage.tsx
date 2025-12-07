import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTripById } from "../api/trips";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { Trip } from "../types/trip";

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const formatDuration = (minutes?: number) => {
  if (!minutes && minutes !== 0) return "";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
};

export const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [trip, setTripData] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTripById(Number(id))
      .then((data) => setTripData(data))
      .catch((err) => setError(err.message || "Unable to load trip"))
      .finally(() => setLoading(false));
  }, [id]);

  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const searchState = useMemo(
    () =>
      (location.state as {
        search?: {
          originId?: number;
          destinationId?: number;
          date?: string;
          originName?: string;
          destinationName?: string;
        };
      } | undefined)?.search,
    [location.state],
  );
  const headerOrigin = searchState?.originName || urlParams.get("originName") || trip?.route.originCity.name;
  const headerDestination =
    searchState?.destinationName || urlParams.get("destinationName") || trip?.route.destinationCity.name;
  const headerDate = searchState?.date || urlParams.get("date") || trip?.departureTime?.split("T")[0];
  const backQuery = useMemo(() => {
    const qs = new URLSearchParams();
    const originId = searchState?.originId || (urlParams.get("originId") ? Number(urlParams.get("originId")) : undefined);
    const destinationId =
      searchState?.destinationId || (urlParams.get("destinationId") ? Number(urlParams.get("destinationId")) : undefined);
    const date = searchState?.date || urlParams.get("date");
    const originName = searchState?.originName || urlParams.get("originName");
    const destinationName = searchState?.destinationName || urlParams.get("destinationName");
    if (originId) {
      qs.set("originId", String(originId));
      if (originName) qs.set("originName", originName);
    }
    if (destinationId) {
      qs.set("destinationId", String(destinationId));
      if (destinationName) qs.set("destinationName", destinationName);
    }
    if (date) qs.set("date", date);
    return qs.toString() ? `?${qs.toString()}` : "";
  }, [searchState, urlParams]);

  const stops = useMemo(() => trip?.route?.stops?.slice().sort((a, b) => a.order - b.order) || [], [trip]);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button className="text-sm text-emerald-200 hover:text-white" onClick={() => navigate(-1)}>
            {"<- Quay lai ket qua"}
          </button>
          <h1 className="text-3xl font-bold text-white">Chi tiết chuyến</h1>
          <p className="text-gray-300 text-sm">Thông tin tuyến, thời gian, loại xe và giá cơ bản.</p>
          {headerOrigin && headerDestination && headerDate ? (
            <p className="text-sm text-emerald-100">
              Đang xem chuyến: {headerOrigin} {"->"} {headerDestination} ngày {headerDate}
            </p>
          ) : null}
        </div>
        <Link to={backQuery ? `/search${backQuery}` : "/search"}>
          <Button variant="secondary">Tìm lại</Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-2/3" />
            <div className="h-4 bg-white/10 rounded" />
          </div>
        </Card>
      ) : null}

      {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

      {!loading && trip ? (
        <>
          <Card>
            <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="space-y-3">
                <div className="text-xs uppercase text-gray-400">Tuyen</div>
                <div className="flex items-center gap-3 text-white text-2xl font-semibold">
                  <span>{trip.route.originCity.name}</span>
                  <span className="text-gray-500 text-lg">{"->"}</span>
                  <span>{trip.route.destinationCity.name}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-100">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
                    <div className="text-xl font-semibold text-white">{formatTime(trip.departureTime)}</div>
                    <div className="text-gray-400 text-xs">{formatDate(trip.departureTime)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Giờ đến</div>
                    <div className="text-xl font-semibold text-white">{formatTime(trip.arrivalTime)}</div>
                    <div className="text-gray-400 text-xs">{formatDate(trip.arrivalTime)}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Thời lượng</div>
                    <div className="text-xl font-semibold text-white">{formatDuration(trip.durationMinutes)}</div>
                    <div className="text-gray-400 text-xs">Ước tính tuyến: {trip.route.estimatedDurationMinutes} phút</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">Trạng thái</div>
                    <div className="text-xl font-semibold text-white">{trip.status}</div>
                    <div className="text-gray-400 text-xs">Cập nhật theo lịch</div>
                  </div>
                </div>
              </div>

            </div>
          </Card>

          <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
            <Card title="Lo trinh">
              {stops.length ? (
                <div className="space-y-4">
                  {stops.map((stop, index) => (
                    <div key={stop.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-emerald-400" />
                        {index < stops.length - 1 ? <div className="flex-1 w-px bg-white/10" /> : null}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white font-semibold">{stop.city.name}</div>
                        <div className="text-xs text-gray-400 uppercase">{stop.type}</div>
                        <div className="text-xs text-gray-400">Cach diem dau: {stop.estimatedOffsetMinutes} phut</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-300">Không có điểm dừng trung gian cho tuyến này.</div>
              )}
            </Card>

            <Card title="Thông tin xe">
              <div className="space-y-3 text-sm text-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-gray-400">Xe</div>
                    <div className="text-lg font-semibold text-white">{trip.bus.name}</div>
                    <div className="text-xs text-gray-400">{trip.bus.busType || "Tieu chuan"} - {trip.bus.plateNumber}</div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {trip.bus.seatMap?.name || "Chua co so do ghe"}
                  </span>
                </div>

                <div>
                  <div className="text-xs uppercase text-gray-400 mb-2">Tiện ích</div>
                  <div className="flex flex-wrap gap-2">
                    {(trip.bus.amenities || []).length ? (
                      trip.bus.amenities!.map((a) => (
                        <span key={a} className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">Không có thông tin</span>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs uppercase text-gray-400">Cần hỗ trợ?</div>
                  <p className="text-sm text-gray-200">
                    Chat với nhân viên nếu cần giữ ghế hoặc ghi chú nhường người già, trẻ em. Phản hồi trong giờ làm việc.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary">Chat nhanh</Button>
                    <Button variant="ghost">Gửi hỗ trợ</Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
