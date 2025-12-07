import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { Route, RouteStop } from '../../types/route';
import type { City } from '../../types/city';

type RouteForm = {
  id?: number;
  name: string;
  originCityId: number | '';
  destinationCityId: number | '';
  estimatedDurationMinutes: number | '';
};

type StopDraft = {
  cityId: number | '';
  type: 'PICKUP' | 'DROPOFF';
  order: number;
  estimatedOffsetMinutes: number;
};

export const RoutesPage = () => {
  const { accessToken } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState<RouteForm>({
    name: '',
    originCityId: '',
    destinationCityId: '',
    estimatedDurationMinutes: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stopsRouteId, setStopsRouteId] = useState<number | null>(null);
  const [stopsDraft, setStopsDraft] = useState<StopDraft[]>([]);
  const [error, setError] = useState('');

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${accessToken}` }),
    [accessToken],
  );

  const loadCities = useCallback(
    () => apiClient<City[]>('/admin/cities', { headers }).then(setCities),
    [headers],
  );

  const loadRoutes = useCallback(
    () => apiClient<Route[]>('/admin/routes', { headers }).then(setRoutes),
    [headers],
  );

  useEffect(() => {
    if (!accessToken) return;
    loadCities();
    loadRoutes();
  }, [accessToken, loadCities, loadRoutes]);
  const autoName = (originId?: number | '', destId?: number | '') => {
    if (!originId || !destId) return '';
    const origin = cities.find((c) => c.id === originId);
    const dest = cities.find((c) => c.id === destId);
    if (!origin || !dest) return '';
    return `${origin.name} - ${dest.name}`;
  };

  const resetForm = () => {
    setForm({
      name: '',
      originCityId: '',
      destinationCityId: '',
      estimatedDurationMinutes: '',
    });
    setEditingId(null);
  };

  const submitRoute = async () => {
    setError('');
    if (!form.originCityId || !form.destinationCityId || !form.estimatedDurationMinutes) {
      setError('Vui lòng nhập đủ thông tin tuyến.');
      return;
    }
    if (form.originCityId === form.destinationCityId) {
      setError('Điểm đi và điểm đến không được trùng nhau.');
      return;
    }
    const auto = autoName(form.originCityId, form.destinationCityId);
    const name = form.name || auto;
    console.log(name)
    const originCityId = Number(form.originCityId);
    console.log(originCityId)
    const destinationCityId = Number(form.destinationCityId);
    console.log(destinationCityId)
    const estimatedDurationMinutes = Number(form.estimatedDurationMinutes);
    console.log(estimatedDurationMinutes)
    if (!Number.isFinite(originCityId) || originCityId <= 0) {
      setError('Vui lòng chọn điểm đi hợp lệ.');
      return;
    }
    if (!Number.isFinite(destinationCityId) || destinationCityId <= 0) {
      setError('Vui lòng chọn điểm đến hợp lệ.');
      return;
    }
    if (!Number.isFinite(estimatedDurationMinutes) || estimatedDurationMinutes <= 0) {
      setError('Thời gian phải là số phút dương.');
      return;
    }
    const payload = {
      name,
      originCityId,
      destinationCityId,
      estimatedDurationMinutes,
    };
    try {
      if (editingId) {
        await apiClient(`/admin/routes/${editingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload),
        });
      } else {
        await apiClient('/admin/routes', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      loadRoutes();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const startEdit = (route: Route) => {
    setForm({
      id: route.id,
      name: route.name,
      originCityId: route.originCity.id,
      destinationCityId: route.destinationCity.id,
      estimatedDurationMinutes: route.estimatedDurationMinutes,
    });
    setEditingId(route.id);
  };

  const loadStops = async (routeId: number) => {
    const res = await apiClient<RouteStop[]>(`/admin/routes/${routeId}/stops`, { headers });
    setStopsDraft(
      res.map((s) => ({
        cityId: s.city.id,
        type: s.type,
        order: s.order,
        estimatedOffsetMinutes: s.estimatedOffsetMinutes,
      })),
    );
    setStopsRouteId(routeId);
  };

  const addStopRow = () => {
    setStopsDraft((prev) => [
      ...prev,
      {
        cityId: '',
        type: 'PICKUP',
        order: prev.length + 1,
        estimatedOffsetMinutes: 0,
      },
    ]);
  };

  const saveStops = async () => {
    if (!stopsRouteId) return;
    await apiClient(`/admin/routes/${stopsRouteId}/stops`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stops: stopsDraft.map((s) => ({ ...s, cityId: Number(s.cityId) })) }),
    });
    setStopsRouteId(null);
    setStopsDraft([]);
    loadRoutes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tuyến đường</h1>
          <p className="text-sm text-gray-400">Quản lý tuyến, điểm đón/trả.</p>
        </div>
      </div>

      <Card title={editingId ? 'Cập nhật tuyến' : 'Thêm tuyến'}>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            label="Tên tuyến"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FormField
            label="Thời gian (phút)"
            type="number"
            value={form.estimatedDurationMinutes}
            onChange={(e) =>
              setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) || '' })
            }
          />
          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Điểm đi</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={form.originCityId}
              onChange={(e) => {
                const value = Number(e.target.value);
                const newName = autoName(value, form.destinationCityId);
                setForm((prev) => ({
                  ...prev,
                  originCityId: value,
                  name: newName || prev.name,
                }));
              }}
            >
              <option value="">Chọn thành phố</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Điểm đến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
              value={form.destinationCityId}
              onChange={(e) => {
                const value = Number(e.target.value);
                const newName = autoName(form.originCityId, value);
                setForm((prev) => ({
                  ...prev,
                  destinationCityId: value,
                  name: newName || prev.name,
                }));
              }}
            >
              <option value="">Chọn thành phố</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <div className="text-error text-sm mt-2">{error}</div> : null}
        <div className="mt-4 flex gap-2">
          <Button onClick={submitRoute}>{editingId ? 'Lưu thay đổi' : 'Tạo tuyến'}</Button>
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              Hủy
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Danh sách tuyến">
        <div className="divide-y divide-white/5 text-sm text-gray-200">
          {routes.map((r) => (
            <div key={r.id} className="py-3 grid md:grid-cols-5 gap-3 items-center">
              <div>
                <div className="font-semibold text-white">{r.name}</div>
                <div className="text-xs text-gray-400">{r.id}</div>
              </div>
              <div>
                <div className="text-white">{r.originCity.name}</div>
                <div className="text-xs text-gray-400">Đi</div>
              </div>
              <div>
                <div className="text-white">{r.destinationCity.name}</div>
                <div className="text-xs text-gray-400">Đến</div>
              </div>
              <div>{r.estimatedDurationMinutes} phút</div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => startEdit(r)}>
                  Sửa
                </Button>
                <Button variant="secondary" onClick={() => loadStops(r.id)}>
                  Điểm đón/trả
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {stopsRouteId ? (
        <Card title={`Điểm dừng cho tuyến #${stopsRouteId}`}>
          <div className="space-y-3">
            {stopsDraft.map((s, idx) => (
              <div
                key={idx}
                className="grid md:grid-cols-[2.2fr_1.2fr_0.6fr_0.6fr] gap-3 items-end"
              >
                <label className="block text-sm text-gray-200">
                  <div className="mb-1 font-medium">Thành phố</div>
                  <select
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                    value={s.cityId}
                    onChange={(e) =>
                      setStopsDraft((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, cityId: Number(e.target.value) } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Chọn</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-gray-200">
                  <div className="mb-1 font-medium">Loại</div>
                  <select
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white"
                    value={s.type}
                    onChange={(e) =>
                      setStopsDraft((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, type: e.target.value as StopDraft['type'] } : item,
                        ),
                      )
                    }
                  >
                    <option value="PICKUP">Đón</option>
                    <option value="DROPOFF">Trả</option>
                  </select>
                </label>
                <FormField
                  label="Thứ tự"
                  type="number"
                  value={s.order}
                  className="w-full"
                  onChange={(e) =>
                    setStopsDraft((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, order: Number(e.target.value) } : item)),
                    )
                  }
                />
                <FormField
                  label="Offset (phút)"
                  type="number"
                  value={s.estimatedOffsetMinutes}
                  className="w-full"
                  onChange={(e) =>
                    setStopsDraft((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, estimatedOffsetMinutes: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={addStopRow}>
                Thêm điểm
              </Button>
              <Button onClick={saveStops}>Lưu điểm dừng</Button>
              <Button variant="ghost" onClick={() => setStopsRouteId(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
};
