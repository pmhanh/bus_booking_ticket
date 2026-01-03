import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getTripById } from "../api/trips";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import type { Trip } from "../types/trip";
import { getTripReviews, createTripReview } from "../api/reviews";
import type { TripReviewsResponse } from "../types/review";
import { useAuth } from "../../auth/context/AuthContext";
import { FormField } from "../../../shared/components/ui/FormField";
import { useToast } from "../../../shared/providers/ToastProvider";

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

const tripStatusLabel: Record<Trip["status"], string> = {
  SCHEDULED: "Đã lên lịch",
  IN_PROGRESS: "Đang chạy",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

export const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuth();
  const { showMessage } = useToast();
  const [trip, setTripData] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<TripReviewsResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTripById(Number(id))
      .then((data) => setTripData(data))
      .catch((err) => setError(err.message || "Unable to load trip"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setReviewLoading(true);
    getTripReviews(Number(id))
      .then(setReviews)
      .catch(() => {})
      .finally(() => setReviewLoading(false));
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
  const bookingState = useMemo(() => {
    if (!trip) return null;
    const originIdFromParams = urlParams.get("originId");
    const destinationIdFromParams = urlParams.get("destinationId");
    const dateFromParams = urlParams.get("date");
    return {
      originId: searchState?.originId || (originIdFromParams ? Number(originIdFromParams) : trip.route.originCity.id),
      destinationId:
        searchState?.destinationId ||
        (destinationIdFromParams ? Number(destinationIdFromParams) : trip.route.destinationCity.id),
      date: searchState?.date || dateFromParams || trip.departureTime?.split("T")[0],
      originName: searchState?.originName || urlParams.get("originName") || trip.route.originCity.name,
      destinationName: searchState?.destinationName || urlParams.get("destinationName") || trip.route.destinationCity.name,
    };
  }, [trip, searchState, urlParams]);

  const bookingQuery = useMemo(() => {
    if (!bookingState) return "";
    const qs = new URLSearchParams();
    if (bookingState.originId) {
      qs.set("originId", String(bookingState.originId));
      if (bookingState.originName) qs.set("originName", bookingState.originName);
    }
    if (bookingState.destinationId) {
      qs.set("destinationId", String(bookingState.destinationId));
      if (bookingState.destinationName) qs.set("destinationName", bookingState.destinationName);
    }
    if (bookingState.date) qs.set("date", bookingState.date);
    return qs.toString() ? `?${qs.toString()}` : "";
  }, [bookingState]);

  const submitReview = async () => {
    if (!accessToken) {
      showMessage({ type: "error", message: "Bạn cần đăng nhập để bình luận." });
      return;
    }
    if (!id) return;
    if (!content.trim()) {
      showMessage({ type: "error", message: "Vui lòng nhập nội dung bình luận." });
      return;
    }
    try {
      await createTripReview(Number(id), { rating: Number(rating), content: content.trim() }, accessToken);
      setContent("");
      showMessage({ type: "success", message: "Đã gửi review." });
      setReviews(await getTripReviews(Number(id)));
    } catch (e) {
      showMessage({ type: "error", message: (e as Error)?.message || "Gửi review thất bại" });
    }
  };

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
        {trip && bookingState ? (
          <Link
            to={bookingQuery ? `/trips/${trip.id}/select-seats${bookingQuery}` : `/trips/${trip.id}/select-seats`}
            state={{ search: bookingState }}
          >
            <Button>Đặt chỗ</Button>
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            Đặt chỗ
          </Button>
        )}
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
                    <div className="text-xl font-semibold text-white">{tripStatusLabel[trip.status]}</div>
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

            <Card title={`Đánh giá (${reviews?.count ?? 0})`}>
              <div className="text-sm text-gray-300 mb-2">
                Trung bình: <span className="text-white font-semibold">{(reviews?.avgRating ?? 0).toFixed(1)}</span>/5
              </div>
              {reviewLoading ? <div className="text-sm text-gray-400">Đang tải đánh giá...</div> : null}

              {user ? (
                <div className="space-y-2 mb-4">
                  <FormField
                    label="Điểm (1-5)"
                    type="number"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    min={1}
                    max={5}
                  />
                  <FormField
                    label="Bình luận"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Viết trải nghiệm của bạn"
                  />
                  <Button onClick={submitReview}>Gửi</Button>
                </div>
              ) : (
                <div className="text-sm text-gray-400 mb-3">Đăng nhập để viết bình luận.</div>
              )}

              <div className="space-y-3">
                {reviews?.items?.length ? (
                  reviews.items.map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white font-semibold">{r.user.fullName || r.user.email || "User"}</div>
                        <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString("vi-VN")}</div>
                      </div>
                      <div className="text-xs text-emerald-200">Rating: {r.rating}/5</div>
                      <div className="text-sm text-gray-200 mt-1">{r.content}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400">Chưa có đánh giá.</div>
                )}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
