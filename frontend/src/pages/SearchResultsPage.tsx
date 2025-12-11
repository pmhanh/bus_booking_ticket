import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { HomeSearchForm } from '../components/search/HomeSearchForm';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { searchTrips, type TripSearchParams, type TripSearchResponse } from '../api/trips';
import type { Trip } from '../types/trip';
import { RangeSlider } from '../components/ui/RangeSlider';

const BUS_TYPES: { value: string; label: string }[] = [
  { value: 'STANDARD', label: 'Tiêu chuẩn' },
  { value: 'SLEEPER', label: 'Giường nằm' },
  { value: 'LIMOUSINE', label: 'Limousine' },
  { value: 'MINIBUS', label: 'Minibus' },
];
const AMENITIES = ['WiFi', 'Nước uống', 'Sạc điện', 'Chăn', 'Đồ ăn nhẹ', 'Toilet'];

const parseSearchParams = (params: URLSearchParams): TripSearchParams => {
  const toNumber = (value: string | null) => (value ? Number(value) : undefined);
  const amenities = params.getAll('amenities').filter(Boolean);
  return {
    originId: toNumber(params.get('originId')),
    destinationId: toNumber(params.get('destinationId')),
    date: params.get('date') || undefined,
    startTime: params.get('startTime') || undefined,
    endTime: params.get('endTime') || undefined,
    minPrice: toNumber(params.get('minPrice')),
    maxPrice: toNumber(params.get('maxPrice')),
    busType: params.get('busType') || undefined,
    amenities: amenities.length ? amenities : undefined,
    sortBy: (params.get('sortBy') as TripSearchParams['sortBy']) || 'time',
    sortOrder: (params.get('sortOrder') as TripSearchParams['sortOrder']) || 'asc',
    page: toNumber(params.get('page')) || 1,
    limit: toNumber(params.get('limit')) || 6,
  };
};

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatDuration = (minutes?: number) => {
  if (!minutes && minutes !== 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
};

const busTypeLabel = (type?: string) => {
  const found = BUS_TYPES.find((b) => b.value.toLowerCase() === (type || '').toLowerCase());
  return found?.label || 'Tiêu chuẩn';
};

const toMinutes = (time?: string) => {
  if (!time) return undefined;
  const [h, m] = time.split(':').map((v) => Number(v));
  if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
  if (h === 24 && m === 0) return 1440;
  return h * 60 + m;
};

const toTimeString = (minutes: number) => {
  const clamped = Math.max(0, Math.min(1440, minutes));
  if (clamped === 1440) return '24:00';
  const h = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const m = (clamped % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const originNameParam = searchParams.get('originName') || undefined;
  const destinationNameParam = searchParams.get('destinationName') || undefined;
  const [result, setResult] = useState<TripSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateParam = (key: string, value: string | number | string[] | undefined | null) => {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((v) => next.append(key, v));
    } else if (value !== undefined && value !== null && value !== '') {
      next.set(key, String(value));
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSearchParams(next);
  };

  useEffect(() => {
    if (!filters.originId || !filters.destinationId || !filters.date) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    searchTrips(filters)
      .then(setResult)
      .catch((err) => setError(err.message || 'Unable to search trips'))
      .finally(() => setLoading(false));
  }, [filters]);

  const prefill = useMemo(() => {
    const trip = result?.data?.[0];
    const originName = originNameParam || trip?.route.originCity.name;
    const destinationName = destinationNameParam || trip?.route.destinationCity.name;
    return {
      origin:
        filters.originId && originName ? { id: filters.originId, name: originName } : trip
          ? { id: trip.route.originCity.id, name: trip.route.originCity.name }
          : undefined,
      destination:
        filters.destinationId && destinationName
          ? { id: filters.destinationId, name: destinationName }
          : trip
            ? { id: trip.route.destinationCity.id, name: trip.route.destinationCity.name }
            : undefined,
      date: filters.date,
    };
  }, [result, filters.originId, filters.destinationId, filters.date, originNameParam, destinationNameParam]);

  const startMinutes = toMinutes(filters.startTime) ?? 0;
  const endMinutes = toMinutes(filters.endTime) ?? 1440;
  const minPrice = filters.minPrice ?? 0;
  const maxPrice = filters.maxPrice ?? 2000000;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <section className="relative z-30 overflow-visible rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-emerald-800/40 p-6 md:p-10 shadow-xl">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-10 -top-10 h-40 w-40 bg-emerald-500/20 blur-3xl" />
          <div className="absolute right-10 top-10 h-24 w-24 bg-blue-500/20 blur-3xl" />
        </div>
        <div className="relative space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Chọn chuyến xe phù hợp với bộ lọc linh hoạt
            </h1>
            {prefill.origin && prefill.destination && prefill.date ? (
              <div className="text-sm text-emerald-100">
                Đang tìm: <span className="font-semibold text-white">{prefill.origin.name}</span> →{' '}
                <span className="font-semibold text-white">{prefill.destination.name}</span> ·{' '}
                <span className="font-semibold text-white">{prefill.date}</span>
              </div>
            ) : null}
          </div>
          <div className="w-full">
            <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              <HomeSearchForm
                initialOrigin={prefill.origin}
                initialDestination={prefill.destination}
                initialDate={prefill.date}
                onSubmit={(params) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('originId', String(params.originId));
                  next.set('originName', params.originName);
                  next.set('destinationId', String(params.destinationId));
                  next.set('destinationName', params.destinationName);
                  next.set('date', params.date);
                  next.set('page', '1');
                  setSearchParams(next);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 grid lg:grid-cols-[320px_1fr] gap-4">
        <Card title="Filters" className="h-fit sticky top-24">
          <div className="space-y-6 text-sm text-gray-100">
            <div>
              <div className="flex items-center justify-between text-xs uppercase text-gray-400 mb-2">
                <span>Giờ đi</span>
                <button
                  className="text-emerald-200 hover:text-white"
                  onClick={() => {
                    updateParam('startTime', undefined);
                    updateParam('endTime', undefined);
                  }}
                >
                  Xóa lọc
                </button>
              </div>
              <div className="space-y-2">
                <RangeSlider
                  min={0}
                  max={1440}
                  step={15}
                  value={[startMinutes, endMinutes]}
                  onChange={([from, to]) => {
                    const next = new URLSearchParams(searchParams);
                    next.set('startTime', toTimeString(from));
                    next.set('endTime', toTimeString(to));
                    next.set('page', '1');
                    setSearchParams(next);
                  }}
                />

                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Từ: {toTimeString(startMinutes)}</span>
                  <span>Đến: {toTimeString(endMinutes)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase text-gray-400">
                <span>Giá (VND)</span>
                <button
                  className="text-emerald-200 hover:text-white"
                  onClick={() => {
                    updateParam('minPrice', undefined);
                    updateParam('maxPrice', undefined);
                  }}
                >
                  Xóa lọc
                </button>
              </div>
              <div className="space-y-2">
                <RangeSlider
                  min={0}
                  max={2000000}
                  step={50000}
                  value={[minPrice, maxPrice]}
                  onChange={([from, to]) => {
                    const next = new URLSearchParams(searchParams);
                    next.set('minPrice', String(from));
                    next.set('maxPrice', String(to));
                    next.set('page', '1');
                    setSearchParams(next);
                  }}
                />

                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>Từ: {minPrice.toLocaleString()} đ</span>
                  <span>Đến: {maxPrice.toLocaleString()} đ</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase text-gray-400">Loại xe</div>
              <div className="flex flex-wrap gap-2">
                {BUS_TYPES.map((type) => {
                  const active = filters.busType === type.value;
                  return (
                    <button
                      key={type.value}
                      className={clsx(
                        'px-3 py-2 rounded-xl border text-sm transition-colors',
                        active
                          ? 'bg-emerald-500/10 border-emerald-400/80 text-emerald-100'
                          : 'border-white/10 text-white hover:border-white/30',
                      )}
                      onClick={() => updateParam('busType', active ? undefined : type.value)}
                    >
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase text-gray-400">Tiện ích</div>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map((amenity) => {
                  const active = filters.amenities?.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      className={clsx(
                        'px-3 py-2 rounded-xl border text-sm transition-colors',
                        active
                          ? 'bg-white/10 border-emerald-300 text-emerald-50'
                          : 'border-white/10 text-white hover:border-white/30',
                      )}
                      onClick={() => {
                        const next = new Set(filters.amenities || []);
                        if (active) {
                          next.delete(amenity);
                        } else {
                          next.add(amenity);
                        }
                        updateParam('amenities', Array.from(next));
                      }}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-300">
              {filters.date ? (
                <>
                  Chuyến ngày <span className="text-white font-semibold">{filters.date}</span>
                  {filters.originId && filters.destinationId ? ' · cập nhật thời gian thực' : null}
                </>
              ) : (
                'Chọn điểm đi, điểm đến và ngày để xem chuyến'
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
                value={filters.sortBy}
                onChange={(e) => updateParam('sortBy', e.target.value)}
              >
                <option value="time">Sắp xếp theo giờ đi</option>
                <option value="price">Sắp xếp theo giá</option>
                <option value="duration">Sắp xếp theo thời gian chạy</option>
              </select>
              <Button
                variant="secondary"
                onClick={() => updateParam('sortOrder', filters.sortOrder === 'desc' ? 'asc' : 'desc')}
              >
                {filters.sortOrder === 'desc' ? 'Giảm dần' : 'Tăng dần'}
              </Button>
            </div>
          </div>

          {loading ? (
            <Card>
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-white/10 rounded" />
                <div className="h-4 bg-white/10 rounded w-5/6" />
                <div className="h-4 bg-white/10 rounded w-4/6" />
              </div>
            </Card>
          ) : null}

          {error ? <Card className="text-red-200 text-sm">{error}</Card> : null}

          {!loading && !error && result?.data?.length
            ? result.data.map((trip) => <TripCard key={trip.id} trip={trip} filters={filters} />)
            : null}

          {!loading && !error && result && result.data.length === 0 ? (
            <Card className="text-center text-gray-300 text-sm">
              Chưa có chuyến phù hợp. Thử nới khoảng giờ hoặc bỏ bớt tiện ích.
            </Card>
          ) : null}

          {result && result.totalPages > 1 ? (
            <div className="flex items-center justify-between border border-white/10 rounded-2xl px-4 py-3">
              <div className="text-sm text-gray-300">
                Trang {result.page} / {result.totalPages} · {result.total} chuyến
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={result.page <= 1}
                  onClick={() => updateParam('page', Math.max(1, (result.page || 1) - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  disabled={result.page >= result.totalPages}
                  onClick={() => updateParam('page', Math.min(result.totalPages, (result.page || 1) + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const TripCard = ({ trip, filters }: { trip: Trip; filters: TripSearchParams }) => {
  const duration = formatDuration(trip.durationMinutes);
  const detailState = {
    originId: filters.originId ?? trip.route.originCity.id,
    destinationId: filters.destinationId ?? trip.route.destinationCity.id,
    date: filters.date ?? trip.departureTime?.split('T')[0],
    originName: trip.route.originCity.name,
    destinationName: trip.route.destinationCity.name,
  };
  const detailQuery = new URLSearchParams();
  if (detailState.originId) {
    detailQuery.set('originId', String(detailState.originId));
    detailQuery.set('originName', detailState.originName);
  }
  if (detailState.destinationId) {
    detailQuery.set('destinationId', String(detailState.destinationId));
    detailQuery.set('destinationName', detailState.destinationName);
  }
  if (detailState.date) detailQuery.set('date', detailState.date);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-4 md:px-6 md:py-5 shadow-card">
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-semibold text-white">{trip.route.originCity.name}</span>
            <span className="text-gray-500">{'->'}</span>
            <span className="font-semibold text-white">{trip.route.destinationCity.name}</span>
            {duration ? <span className="px-2 py-1 rounded-full bg-white/10 text-xs">{duration}</span> : null}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-100">
            <div>
              <div className="text-xs text-gray-400 uppercase">Giờ đi</div>
              <div className="text-lg font-semibold text-white">{formatTime(trip.departureTime)}</div>
              <div className="text-xs text-gray-400">{formatDate(trip.departureTime)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Giờ đến</div>
              <div className="text-lg font-semibold text-white">{formatTime(trip.arrivalTime)}</div>
              <div className="text-xs text-gray-400">{formatDate(trip.arrivalTime)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 uppercase">Xe</div>
              <div className="text-lg font-semibold text-white">{trip.bus.name}</div>
              <div className="text-xs text-gray-400">
                {busTypeLabel(trip.bus.busType)} · {trip.bus.seatMap?.name || 'Chưa có sơ đồ ghế'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-100">
            {(trip.bus.amenities || []).slice(0, 6).map((a) => (
              <span key={a} className="px-3 py-1 rounded-full bg-white/10 border border-white/10">
                {a}
              </span>
            ))}
            {!trip.bus.amenities?.length ? (
              <span className="text-gray-400">No amenity data</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">

          <div className="flex gap-2">
            <Link
              to={detailQuery.toString() ? `/trips/${trip.id}?${detailQuery.toString()}` : `/trips/${trip.id}`}
              state={{ search: detailState }}
            >
              <Button variant="secondary" className="px-4">
                Chi tiết
              </Button>
            </Link>
            <Link
              to={
                detailQuery.toString()
                  ? `/trips/${trip.id}/select-seats?${detailQuery.toString()}`
                  : `/trips/${trip.id}/select-seats`
              }
              state={{ search: detailState }}
            >
              <Button className="px-4">Đặt chỗ</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
