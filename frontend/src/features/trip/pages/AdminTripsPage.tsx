import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { Trip } from '../types/trip';
import type { Route } from '../../route/types/route';
import type { Bus } from '../../bus/types/bus';
import type { City } from '../../route/types/city';
import type { SeatMap } from '../../seatmap/types/seatMap';

type TripForm = {
  id?: number;
  routeId: number | '';
  busId: number | '';
  departureTime: string;
  arrivalTime: string;
  basePrice: number | '';
};

const optionTextStyle: React.CSSProperties = { color: '#111' };
const placeholderOptionStyle: React.CSSProperties = { color: '#666' };

const parseSelectNumber = (value: string): number | '' => {
  if (value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
};

export const AdminTripsPage = () => {
  const { accessToken } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<TripForm>({
    routeId: '',
    busId: '',
    departureTime: '',
    arrivalTime: '',
    basePrice: '',
  });

  const [filters, setFilters] = useState<{
    routeId?: number | '';
    busId?: number | '';
    fromDate?: string;
    toDate?: string;
    originCityId?: number | '';
    destinationCityId?: number | '';
  }>({});

  const [apiMessage, setApiMessage] = useState('');
  const [busMessage, setBusMessage] = useState('');
  const [busForm, setBusForm] = useState<{
    name: string;
    plateNumber: string;
    busType?: string;
    seatMapId?: number | '';
  }>({
    name: '',
    plateNumber: '',
    busType: 'STANDARD',
    seatMapId: '',
  });

  const routesRef = useRef<Route[]>([]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  const loadTrips = useCallback(
    async (availableRoutes?: Route[]) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.routeId) params.append('routeId', String(filters.routeId));
      if (filters.busId) params.append('busId', String(filters.busId));
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);

      try {
        const res = await apiClient<Trip[]>(`/admin/trips?${params.toString()}`, { headers });

        const filtered = res.filter((t) => {
          if (filters.originCityId && t.route.originCity.id !== filters.originCityId) return false;
          if (filters.destinationCityId && t.route.destinationCity.id !== filters.destinationCityId)
            return false;
          return true;
        });

        const routeList = availableRoutes ?? routesRef.current;
        const map = new Map(routeList.map((r) => [r.id, r]));

        setTrips(
          filtered.map((t) => ({
            ...t,
            route: map.get(t.route.id) || t.route,
          })),
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, headers],
  );

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [routeRes, busRes, cityRes, seatMapRes] = await Promise.all([
        apiClient<Route[]>('/admin/routes', { headers }),
        apiClient<Bus[]>('/admin/buses', { headers }),
        apiClient<City[]>('/admin/cities', { headers }),
        apiClient<SeatMap[]>('/admin/seat-maps', { headers }),
      ]);
      setRoutes(routeRes);
      routesRef.current = routeRes;
      setBuses(busRes);
      setCities(cityRes);
      setSeatMaps(seatMapRes);
      await loadTrips(routeRes);
    } finally {
      setLoading(false);
    }
  }, [accessToken, headers, loadTrips]);

  useEffect(() => {
    routesRef.current = routes;
  }, [routes]);

  useEffect(() => {
    void loadData();
  }, [accessToken, loadData]);

  useEffect(() => {
    if (!accessToken) return;
    void loadTrips();
  }, [accessToken, filters, loadTrips]);

  const resetForm = () => {
    setForm({
      routeId: '',
      busId: '',
      departureTime: '',
      arrivalTime: '',
      basePrice: '',
    });
  };

  const submitTrip = async () => {
    setError('');
    setApiMessage('');

    if (!form.routeId || !form.busId || !form.departureTime || !form.arrivalTime || !form.basePrice) {
      setError('Vui lòng nhập đủ thông tin chuyến.');
      return;
    }

    const payload = {
      routeId: Number(form.routeId),
      busId: Number(form.busId),
      departureTime: form.departureTime,
      arrivalTime: form.arrivalTime,
      basePrice: Number(form.basePrice),
    };

    try {
      if (form.id) {
        await apiClient(`/admin/trips/${form.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient('/admin/trips', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      void loadTrips();
    } catch (err) {
      setApiMessage((err as Error).message || 'Không thể lưu chuyến');
    }
  };

  const startEdit = (trip: Trip) => {
    setForm({
      id: trip.id,
      routeId: trip.route.id,
      busId: trip.bus.id,
      departureTime: trip.departureTime.slice(0, 16),
      arrivalTime: trip.arrivalTime.slice(0, 16),
      basePrice: trip.basePrice,
    });
  };

  const deleteTrip = async (id: number) => {
    if (!window.confirm('Xóa chuyến này?')) return;
    await apiClient(`/admin/trips/${id}`, { method: 'DELETE', headers });
    void loadTrips();
  };

  const resetBusForm = () => {
    setBusForm({ name: '', plateNumber: '', busType: 'STANDARD', seatMapId: '' });
    setBusMessage('');
  };

  const submitBus = async () => {
    setBusMessage('');

    if (!busForm.name || !busForm.plateNumber) {
      setBusMessage('Vui lòng nhập tên xe và biển số.');
      return;
    }

    const payload = {
      name: busForm.name,
      plateNumber: busForm.plateNumber,
      busType: busForm.busType,
      seatMapId: busForm.seatMapId ? Number(busForm.seatMapId) : undefined,
    };

    try {
      const bus = await apiClient<Bus>('/admin/buses', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      setBuses((prev) => [...prev, bus]);
      resetBusForm();
    } catch (err) {
      setBusMessage((err as Error).message || 'Không thể tạo xe');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lịch chuyến</h1>
          <p className="text-sm text-gray-400">Tạo, chỉnh sửa chuyến và gán xe.</p>
        </div>
      </div>

      <Card title="Thêm xe (gán sơ đồ ghế)">
        <div className="grid md:grid-cols-4 gap-3">
          <FormField
            label="Tên xe"
            value={busForm.name}
            onChange={(e) => setBusForm({ ...busForm, name: e.target.value })}
          />
          <FormField
            label="Biển số"
            value={busForm.plateNumber}
            onChange={(e) => setBusForm({ ...busForm, plateNumber: e.target.value })}
          />

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Loại xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={busForm.busType}
              onChange={(e) => setBusForm({ ...busForm, busType: e.target.value })}
            >
              <option value="STANDARD" style={optionTextStyle}>
                STANDARD
              </option>
              <option value="SLEEPER" style={optionTextStyle}>
                SLEEPER
              </option>
              <option value="LIMOUSINE" style={optionTextStyle}>
                LIMOUSINE
              </option>
              <option value="MINIBUS" style={optionTextStyle}>
                MINIBUS
              </option>
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Sơ đồ ghế</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={busForm.seatMapId === '' ? '' : String(busForm.seatMapId ?? '')}
              onChange={(e) => {
                const value = parseSelectNumber(e.target.value);
                setBusForm({ ...busForm, seatMapId: value });
              }}
            >
              <option value="" style={placeholderOptionStyle}>
                Chưa gán
              </option>
              {seatMaps.map((m) => (
                <option key={m.id} value={String(m.id)} style={optionTextStyle}>
                  {m.name} ({m.rows}x{m.cols})
                </option>
              ))}
            </select>
          </label>
        </div>

        {busMessage ? <div className="text-sm text-error mt-2">{busMessage}</div> : null}

        <div className="mt-3 flex gap-2">
          <Button onClick={submitBus}>Tạo xe</Button>
          <Button variant="secondary" onClick={resetBusForm}>
            Xóa
          </Button>
        </div>
      </Card>

      <Card title={form.id ? 'Cập nhật chuyến' : 'Tạo chuyến'}>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Tuyến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.routeId === '' ? '' : String(form.routeId)}
              onChange={(e) => setForm({ ...form, routeId: parseSelectNumber(e.target.value) })}
            >
              <option value="" style={placeholderOptionStyle}>
                Chọn tuyến
              </option>
              {routes.map((r) => (
                <option key={r.id} value={String(r.id)} style={optionTextStyle}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.busId === '' ? '' : String(form.busId)}
              onChange={(e) => setForm({ ...form, busId: parseSelectNumber(e.target.value) })}
            >
              <option value="" style={placeholderOptionStyle}>
                Chọn xe
              </option>
              {buses.map((b) => (
                <option key={b.id} value={String(b.id)} style={optionTextStyle}>
                  {b.name} ({b.plateNumber})
                  {b.seatMap ? ` - ${b.seatMap.name}` : ''}
                </option>
              ))}
            </select>
          </label>

          <FormField
            label="Giá cơ bản"
            type="number"
            value={form.basePrice}
            onChange={(e) => {
              const v = e.target.value;
              setForm({ ...form, basePrice: v === '' ? '' : Number(v) });
            }}
          />

          <FormField
            label="Giờ đi"
            type="datetime-local"
            value={form.departureTime}
            onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
          />
          <FormField
            label="Giờ đến"
            type="datetime-local"
            value={form.arrivalTime}
            onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
          />
        </div>

        {error ? <div className="text-error text-sm mt-2">{error}</div> : null}
        {apiMessage ? (
          <div className="mt-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
            {apiMessage}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button onClick={submitTrip}>{form.id ? 'Lưu' : 'Tạo chuyến'}</Button>
          {form.id ? (
            <Button variant="secondary" onClick={resetForm}>
              Hủy
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Bộ lọc">
        <div className="grid md:grid-cols-5 gap-3 text-sm">
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Tuyến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={filters.routeId === '' || filters.routeId == null ? '' : String(filters.routeId)}
              onChange={(e) => setFilters((f) => ({ ...f, routeId: parseSelectNumber(e.target.value) }))}
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {routes.map((r) => (
                <option key={r.id} value={String(r.id)} style={optionTextStyle}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={filters.busId === '' || filters.busId == null ? '' : String(filters.busId)}
              onChange={(e) => setFilters((f) => ({ ...f, busId: parseSelectNumber(e.target.value) }))}
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {buses.map((b) => (
                <option key={b.id} value={String(b.id)} style={optionTextStyle}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <FormField
            label="Từ ngày"
            type="date"
            value={filters.fromDate ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
          />
          <FormField
            label="Đến ngày"
            type="date"
            value={filters.toDate ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
          />

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Điểm đi</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={
                filters.originCityId === '' || filters.originCityId == null ? '' : String(filters.originCityId)
              }
              onChange={(e) => setFilters((f) => ({ ...f, originCityId: parseSelectNumber(e.target.value) }))}
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {cities.map((c) => (
                <option key={c.id} value={String(c.id)} style={optionTextStyle}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Điểm đến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={
                filters.destinationCityId === '' || filters.destinationCityId == null
                  ? ''
                  : String(filters.destinationCityId)
              }
              onChange={(e) =>
                setFilters((f) => ({ ...f, destinationCityId: parseSelectNumber(e.target.value) }))
              }
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {cities.map((c) => (
                <option key={c.id} value={String(c.id)} style={optionTextStyle}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title={loading ? 'Đang tải...' : 'Danh sách chuyến'}>
        <div className="grid grid-cols-6 gap-3 text-xs uppercase text-gray-400 border-b border-white/5 pb-2">
          <div>Tuyến</div>
          <div>Xe</div>
          <div>Giờ đi</div>
          <div>Giờ đến</div>
          <div>Giá</div>
          <div className="text-right">Thao tác</div>
        </div>
        <div className="divide-y divide-white/5 text-sm text-gray-200">
          {trips.map((t) => (
            <div key={t.id} className="grid grid-cols-6 gap-3 py-2 items-center">
              <div>
                <div className="text-white font-semibold">{t.route?.name || '-'}</div>
                <div className="text-xs text-gray-400">
                  {t.route?.originCity?.name ?? '?'} {'->'} {t.route?.destinationCity?.name ?? '?'}
                </div>
              </div>
              <div>
                <div className="text-white">{t.bus?.name || '-'}</div>
                <div className="text-xs text-gray-400">
                  {t.bus?.plateNumber || ''} {t.bus?.seatMap ? `• ${t.bus.seatMap.name}` : ''}
                </div>
              </div>
              <div className="text-xs text-gray-200">{new Date(t.departureTime).toLocaleString()}</div>
              <div className="text-xs text-gray-200">{new Date(t.arrivalTime).toLocaleString()}</div>
              <div className="text-white font-semibold">{t.basePrice.toLocaleString('vi-VN')}đ</div>
              <div className="text-right space-x-2">
                <Button variant="secondary" onClick={() => startEdit(t)}>
                  Sửa
                </Button>
                <Button variant="ghost" onClick={() => deleteTrip(t.id)}>
                  Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
