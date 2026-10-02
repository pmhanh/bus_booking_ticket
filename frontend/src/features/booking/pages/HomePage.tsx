import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeSearchForm } from '../components/HomeSearchForm';
import { searchTrips } from '../../trip/api/trips';
import type { Trip } from '../../trip/types/trip';
import { TripFare } from '../../trip/components/TripFare';
import { busTypeLabel } from '../../../shared/utils/displayLabels';
import { Button } from '../../../shared/components/ui/Button';

const departureLabel = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const HomePage = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      setLoading(true);
      setError(false);
      try {
        const result = await searchTrips({
          sortBy: 'time',
          sortOrder: 'asc',
          limit: 6,
        });
        if (active) setTrips(result.data);
      } catch {
        if (active) {
          setTrips([]);
          setError(true);
        }
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [retry]);

  return (
    <div className="relative mx-auto max-w-6xl space-y-10 pb-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold leading-tight text-white md:text-5xl">
          Tìm chuyến xe,{' '}
          <span className="text-emerald-400">bắt đầu hành trình.</span>
        </h1>
        <p className="mt-3 text-gray-300">
          Chọn điểm đi, điểm đến và ngày khởi hành để xem lịch xe và giá vé.
        </p>
      </div>

      <section className="mx-auto max-w-4xl rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl md:p-8">
        <h2 className="mb-4 text-center text-2xl font-semibold text-white">
          Tìm chuyến xe của bạn
        </h2>
        <HomeSearchForm />
      </section>

      <section aria-labelledby="upcoming-trips-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="upcoming-trips-title"
              className="text-xl font-semibold text-white"
            >
              Chuyến sắp khởi hành
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Các chuyến gần nhất theo lịch hiện có. Giờ hiển thị theo múi giờ
              Việt Nam.
            </p>
          </div>
          <Link
            to="/search"
            className="text-sm font-semibold text-emerald-300 hover:underline"
          >
            Xem thêm chuyến →
          </Link>
        </div>
        {loading ? (
          <p
            role="status"
            className="rounded-2xl bg-white/5 p-8 text-center text-gray-300"
          >
            Đang tải lịch chuyến...
          </p>
        ) : error ? (
          <div
            role="alert"
            className="space-y-3 rounded-2xl bg-white/5 p-8 text-center"
          >
            <p className="text-gray-300">
              Chưa tải được lịch chuyến. Vui lòng thử lại.
            </p>
            <Button
              variant="secondary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </Button>
          </div>
        ) : trips.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-8 text-center text-gray-300">
            Hiện chưa có chuyến sắp khởi hành. Bạn có thể quay lại kiểm tra lịch
            sau.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <article
                key={trip.id}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-lg font-semibold text-white">
                  {trip.route.originCity.name} →{' '}
                  {trip.route.destinationCity.name}
                </h3>
                <p className="mt-3 text-sm text-emerald-200">
                  Khởi hành: {departureLabel(trip.departureTime)}
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  {trip.bus.name} · {busTypeLabel(trip.bus.busType)}
                </p>
                <div className="my-4">
                  <TripFare price={trip.basePrice} />
                </div>
                <Link
                  to={'/trips/' + trip.id}
                  className="mt-auto rounded-xl bg-emerald-500/15 px-4 py-3 text-center font-semibold text-emerald-200 hover:bg-emerald-500/25"
                >
                  Xem chi tiết chuyến
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
