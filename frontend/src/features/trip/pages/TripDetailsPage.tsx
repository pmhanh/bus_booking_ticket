import { formatTime, formatDate } from '../../../shared/utils/formatDate';
import { BackNavigationLayout } from '../../../shared/components/ui/BackNavigationLayout';
import { formatDuration } from '../../../shared/utils/formatDuration';
import { statusLabel } from '../../../shared/utils/displayLabels';
import { useErrorNotification } from '../../../shared/providers/useErrorNotification';
import { TripFare } from '../components/TripFare';
import {
  busTypeLabel,
  amenityLabel,
} from '../../../shared/utils/displayLabels';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getTripById } from '../api/trips';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { getTripDisplayStatus, type Trip } from '../types/trip';
import {
  getTripReviews,
  createTripReview,
  updateTripReview,
  deleteTripReview,
} from '../api/reviews';
import type { Review, TripReviewsResponse } from '../types/review';
import { useAuth } from '../../auth/context/AuthContext';
import { FormField } from '../../../shared/components/ui/FormField';
import { useToast } from '../../../shared/providers/ToastProvider';

export const TripDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken } = useAuth();
  const { showMessage, confirm } = useToast();
  const [trip, setTripData] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useErrorNotification();
  const [reviews, setReviews] = useState<TripReviewsResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const ownReview = reviews?.items.find(
    (review) => review.user.id === user?.id,
  );

  const resetReviewForm = () => {
    setEditingReviewId(null);
    setRating(5);
    setContent('');
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTripById(Number(id))
      .then((data) => setTripData(data))
      .catch((err) =>
        setError(err.message || 'Không thể tải thông tin chuyến xe'),
      )
      .finally(() => setLoading(false));
  }, [id, setError]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setReviews(null);
    setEditingReviewId(null);
    setRating(5);
    setContent('');
    setReviewLoading(true);
    getTripReviews(Number(id))
      .then((data) => {
        if (active) setReviews(data);
      })
      .catch(() => {
        if (active)
          showMessage({
            type: 'error',
            message: 'Không thể tải đánh giá. Vui lòng tải lại trang.',
          });
      })
      .finally(() => {
        if (active) setReviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user?.id, showMessage]);

  const urlParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const searchState = useMemo(
    () =>
      (
        location.state as
          | {
              search?: {
                originId?: number;
                destinationId?: number;
                date?: string;
                originName?: string;
                destinationName?: string;
              };
            }
          | undefined
      )?.search,
    [location.state],
  );
  const stops = useMemo(
    () => trip?.route?.stops?.slice().sort((a, b) => a.order - b.order) || [],
    [trip],
  );
  const bookingState = useMemo(() => {
    if (!trip) return null;
    const originIdFromParams = urlParams.get('originId');
    const destinationIdFromParams = urlParams.get('destinationId');
    const dateFromParams = urlParams.get('date');
    return {
      originId:
        searchState?.originId ||
        (originIdFromParams
          ? Number(originIdFromParams)
          : trip.route.originCity.id),
      destinationId:
        searchState?.destinationId ||
        (destinationIdFromParams
          ? Number(destinationIdFromParams)
          : trip.route.destinationCity.id),
      date:
        searchState?.date ||
        dateFromParams ||
        trip.departureTime?.split('T')[0],
      originName:
        searchState?.originName ||
        urlParams.get('originName') ||
        trip.route.originCity.name,
      destinationName:
        searchState?.destinationName ||
        urlParams.get('destinationName') ||
        trip.route.destinationCity.name,
    };
  }, [trip, searchState, urlParams]);

  const bookingQuery = useMemo(() => {
    if (!bookingState) return '';
    const qs = new URLSearchParams();
    if (bookingState.originId) {
      qs.set('originId', String(bookingState.originId));
      if (bookingState.originName)
        qs.set('originName', bookingState.originName);
    }
    if (bookingState.destinationId) {
      qs.set('destinationId', String(bookingState.destinationId));
      if (bookingState.destinationName)
        qs.set('destinationName', bookingState.destinationName);
    }
    if (bookingState.date) qs.set('date', bookingState.date);
    return qs.toString() ? `?${qs.toString()}` : '';
  }, [bookingState]);

  const submitReview = async () => {
    if (reviewPending) return;
    if (!accessToken) {
      showMessage({
        type: 'error',
        message: 'Bạn cần đăng nhập để bình luận.',
      });
      return;
    }
    if (!id || !reviews) return;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      showMessage({
        type: 'error',
        message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5.',
      });
      return;
    }
    if (!content.trim()) {
      showMessage({
        type: 'error',
        message: 'Vui lòng nhập nội dung bình luận.',
      });
      return;
    }
    setReviewPending(true);
    try {
      const payload = {
        rating: Number(rating),
        content: content.trim(),
      };
      if (editingReviewId) {
        await updateTripReview(editingReviewId, payload);
      } else {
        await createTripReview(Number(id), payload);
      }
      resetReviewForm();
      showMessage({
        type: 'success',
        message: editingReviewId ? 'Đã cập nhật đánh giá.' : 'Đã gửi đánh giá.',
      });
      await refreshReviews();
    } catch (e) {
      showMessage({
        type: 'error',
        message: (e as Error)?.message || 'Không thể lưu đánh giá.',
      });
    } finally {
      setReviewPending(false);
    }
  };

  const refreshReviews = async () => {
    try {
      setReviews(await getTripReviews(Number(id)));
    } catch {
      setReviews(null);
      showMessage({
        type: 'error',
        message:
          'Thao tác đã thành công nhưng chưa tải lại được đánh giá. Vui lòng tải lại trang.',
      });
    }
  };

  const editReview = (review: Review) => {
    setEditingReviewId(review.id);
    setRating(review.rating);
    setContent(review.content);
  };

  const removeReview = async (reviewId: string) => {
    if (reviewPending) return;
    setReviewPending(true);
    try {
      const accepted = await confirm({
        title: 'Xóa đánh giá',
        message:
          'Bạn có chắc muốn xóa đánh giá này? Hành động này không thể hoàn tác.',
        confirmText: 'Xóa đánh giá',
        cancelText: 'Hủy',
        danger: true,
      });
      if (!accepted) return;
      await deleteTripReview(reviewId);
      resetReviewForm();
      showMessage({ type: 'success', message: 'Đã xóa đánh giá.' });
      await refreshReviews();
    } catch (e) {
      showMessage({
        type: 'error',
        message: (e as Error)?.message || 'Không thể xóa đánh giá.',
      });
    } finally {
      setReviewPending(false);
    }
  };

  return (
    <BackNavigationLayout
      onBack={() => navigate(-1)}
      backLabel="Quay lại kết quả"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Chi tiết chuyến</h1>
        </div>
        {trip && bookingState ? (
          <div className="flex flex-wrap items-center gap-4">
            <TripFare price={trip.basePrice} />
            <Link
              to={
                bookingQuery
                  ? `/trips/${trip.id}/select-seats${bookingQuery}`
                  : `/trips/${trip.id}/select-seats`
              }
              state={{ search: bookingState }}
            >
              <Button>Đặt chỗ</Button>
            </Link>
          </div>
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
                <div className="flex items-center gap-3 text-white text-2xl font-semibold">
                  <span>{trip.route.originCity.name}</span>
                  <span className="text-gray-500 text-lg">{'->'}</span>
                  <span>{trip.route.destinationCity.name}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-100">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">
                      Giờ đi
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {formatTime(trip.departureTime)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {formatDate(trip.departureTime)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">
                      Giờ đến
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {formatTime(trip.arrivalTime)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {formatDate(trip.arrivalTime)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">
                      Thời lượng
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {formatDuration(trip.durationMinutes)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Ước tính tuyến: {trip.route.estimatedDurationMinutes} phút
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-gray-400 uppercase">
                      Trạng thái
                    </div>
                    <div className="text-xl font-semibold text-white">
                      {statusLabel(getTripDisplayStatus(trip))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-4">
            <Card title="Lộ trình điểm dừng giữa đường">
              {stops.length ? (
                <div className="space-y-4">
                  {stops.map((stop, index) => (
                    <div key={stop.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-emerald-400" />
                        {index < stops.length - 1 ? (
                          <div className="flex-1 w-px bg-white/10" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white font-semibold">
                          {stop.city.name}
                        </div>
                        <div className="text-xs text-gray-400 uppercase">
                          {stop.type === 'PICKUP' ? 'Điểm đón' : 'Điểm trả'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Cách điểm đi: {stop.estimatedOffsetMinutes} phút
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-300">
                  Không có điểm dừng trung gian cho tuyến này.
                </div>
              )}
            </Card>

            <Card title="Thông tin xe">
              <div className="space-y-3 text-sm text-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase text-gray-400">Xe</div>
                    <div className="text-lg font-semibold text-white">
                      {trip.bus.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {busTypeLabel(trip.bus.busType)} - {trip.bus.plateNumber}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs">
                    {trip.bus.seatMap?.name || 'Chưa có sơ đồ ghế'}
                  </span>
                </div>

                <div>
                  <div className="text-xs uppercase text-gray-400 mb-2">
                    Tiện ích
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(trip.bus.amenities || []).length ? (
                      trip.bus.amenities!.map((a) => (
                        <span
                          key={amenityLabel(a)}
                          className="px-3 py-1 rounded-full bg-white/10 border border-white/10"
                        >
                          {amenityLabel(a)}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">Không có thông tin</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card title={`Đánh giá (${reviews?.count ?? 0})`}>
              <div className="text-sm text-gray-300 mb-2">
                Trung bình:{' '}
                <span className="text-white font-semibold">
                  {(reviews?.avgRating ?? 0).toFixed(1)}
                </span>
                /5
              </div>
              {reviewLoading ? (
                <div className="text-sm text-gray-400">
                  Đang tải đánh giá...
                </div>
              ) : null}

              {user &&
              reviews &&
              (!ownReview || editingReviewId === ownReview.id) ? (
                <form
                  className="space-y-2 mb-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitReview();
                  }}
                >
                  <div className="text-sm font-semibold text-white">
                    {editingReviewId
                      ? 'Chỉnh sửa đánh giá của bạn'
                      : 'Viết đánh giá'}
                  </div>
                  <FormField
                    label="Điểm (1-5)"
                    type="number"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    min={1}
                    max={5}
                    step={1}
                    required
                    disabled={reviewPending}
                  />
                  <FormField
                    label="Bình luận"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Viết trải nghiệm của bạn"
                    required
                    disabled={reviewPending}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" loading={reviewPending}>
                      {editingReviewId ? 'Lưu thay đổi' : 'Gửi đánh giá'}
                    </Button>
                    {editingReviewId ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={reviewPending}
                        onClick={resetReviewForm}
                      >
                        Hủy chỉnh sửa
                      </Button>
                    ) : null}
                  </div>
                </form>
              ) : !user ? (
                <div className="text-sm text-gray-400 mb-3">
                  Đăng nhập để viết bình luận.
                </div>
              ) : ownReview ? (
                <div className="text-sm text-gray-400 mb-3">
                  Bạn đã đánh giá chuyến đi này. Bạn có thể sửa hoặc xóa đánh
                  giá bên dưới.
                </div>
              ) : null}

              <div className="space-y-3">
                {reviews?.items?.length ? (
                  reviews.items.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white font-semibold">
                          {r.user.fullName || r.user.email || 'Người dùng'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(r.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <div className="text-xs text-emerald-200">
                        Điểm đánh giá: {r.rating}/5
                      </div>
                      <div className="text-sm text-gray-200 mt-1">
                        {r.content}
                      </div>
                      {r.user.id === user?.id ? (
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            disabled={reviewPending}
                            onClick={() => editReview(r)}
                          >
                            Sửa đánh giá
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-red-300"
                            disabled={reviewPending}
                            onClick={() => void removeReview(r.id)}
                          >
                            Xóa đánh giá
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : !reviewLoading ? (
                  <div className="text-sm text-gray-400">
                    {reviews
                      ? 'Chưa có đánh giá.'
                      : 'Không thể tải đánh giá. Vui lòng tải lại trang.'}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </BackNavigationLayout>
  );
};
