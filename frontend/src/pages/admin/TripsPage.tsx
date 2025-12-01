import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Bus, City, Route, Trip } from '../../types/admin';

type TripForm = {
  id?: number;
  routeId: number | '';
  busId: number | '';
  departureTime: string;
  arrivalTime: string;
  basePrice: number | '';
};

export const TripsPage = () => {
  const { accessToken } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
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

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  const loadData = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [routeRes, busRes, cityRes] = await Promise.all([
        apiClient<Route[]>('/admin/routes', { headers }),
        apiClient<Bus[]>('/admin/buses', { headers }),
        apiClient<City[]>('/admin/cities', { headers }),
      ]);
      setRoutes(routeRes);
      setBuses(busRes);
      setCities(cityRes);
      await loadTrips(routeRes);
    } finally {
      setLoading(false);
    }
  };

  const loadTrips = async (availableRoutes = routes) => {
    const params = new URLSearchParams();
    if (filters.routeId) params.append('routeId', String(filters.routeId));
    if (filters.busId) params.append('busId', String(filters.busId));
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);
    const res = await apiClient<Trip[]>(`/admin/trips?${params.toString()}`, { headers });
    // Nếu lọc theo origin/destination, lọc client-side
    const filtered = res.filter((t) => {
      if (filters.originCityId && t.route.originCity.id !== filters.originCityId) return false;
      if (filters.destinationCityId && t.route.destinationCity.id !== filters.destinationCityId)
        return false;
      return true;
    });
    // map route from availableRoutes to include latest names
    const map = new Map(availableRoutes.map((r) => [r.id, r]));
    setTrips(
      filtered.map((t) => ({
        ...t,
        route: map.get(t.route.id) || t.route,
      })),
    );
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    loadTrips();
  }, [filters.routeId, filters.busId, filters.fromDate, filters.toDate, filters.originCityId, filters.destinationCityId]);

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
      loadTrips();
    } catch (err) {
      setError((err as Error).message);
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
    loadTrips();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lịch chuyến</h1>
          <p className="text-sm text-gray-400">Tạo, chỉnh sửa chuyến và gán xe.</p>
        </div>
      </div>

      <Card title={form.id ? 'Cập nhật chuyến' : 'Tạo chuyến'}>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Tuyến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={form.routeId}
              onChange={(e) => setForm({ ...form, routeId: Number(e.target.value) })}
            >
              <option value="">Chọn tuyến</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={form.busId}
              onChange={(e) => setForm({ ...form, busId: Number(e.target.value) })}
            >
              <option value="">Chọn xe</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.plateNumber})
                </option>
              ))}
            </select>
          </label>
          <FormField
            label="Giá cơ bản"
            type="number"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) || '' })}
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
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={filters.routeId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, routeId: e.target.value ? Number(e.target.value) : '' }))}
            >
              <option value="">Tất cả</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={filters.busId ?? ''}
              onChange={(e) => setFilters((f) => ({ ...f, busId: e.target.value ? Number(e.target.value) : '' }))}
            >
              <option value="">Tất cả</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
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
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={filters.originCityId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  originCityId: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Tất cả</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-200">
            <div className="mb-1 font-medium">Điểm đến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={filters.destinationCityId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  destinationCityId: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Tất cả</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
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
                <div className="text-white font-semibold">{t.route.name}</div>
                <div className="text-xs text-gray-400">
                  {t.route.originCity.name} → {t.route.destinationCity.name}
                </div>
              </div>
              <div>
                <div className="text-white">{t.bus.name}</div>
                <div className="text-xs text-gray-400">{t.bus.plateNumber}</div>
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
