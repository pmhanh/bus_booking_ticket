import {
  optionTextStyle,
  placeholderOptionStyle,
  parseSelectNumber,
} from '../../../shared/utils/select';
import { useToast } from '../../../shared/providers/ToastProvider';
import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { Route, RouteStop } from '../types/route';
import type { City } from '../types/city';
import { searchCities } from '../api/cities';

type RouteForm = {
  id?: number;
  name: string;
  originCityId: number | '';
  destinationCityId: number | '';
  estimatedDurationMinutes: number | '';
};

type StopDraft = {
  id?: number;
  cityId: number | '';
  type: 'PICKUP' | 'DROPOFF';
  order: number | '';
  estimatedOffsetMinutes: number | '';
};

type StopPayload = {
  id?: number;
  cityId: number;
  type: 'PICKUP' | 'DROPOFF';
  order: number;
  estimatedOffsetMinutes: number;
};

const createEmptyStopDraft = (order: number): StopDraft => ({
  cityId: '',
  type: 'PICKUP',
  order,
  estimatedOffsetMinutes: 0,
});

export const AdminRoutesPage = () => {
  const { showError, showSuccess } = useToast();
  const { accessToken } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState<RouteForm>({
    name: '',
    originCityId: '',
    destinationCityId: '',
    estimatedDurationMinutes: '',
  });
  const [createStopsDraft, setCreateStopsDraft] = useState<StopDraft[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stopsRouteId, setStopsRouteId] = useState<number | null>(null);
  const [stopsDraft, setStopsDraft] = useState<StopDraft[]>([]);

  const [citiesLoading, setCitiesLoading] = useState(false);

  const [syncingCities, setSyncingCities] = useState(false);
  const [savingStops, setSavingStops] = useState(false);

  const loadCities = useCallback(async () => {
    setCitiesLoading(true);

    try {
      setCities(await searchCities('', 100));
    } catch (err) {
      setCities([]);
      showError((err as Error).message);
    } finally {
      setCitiesLoading(false);
    }
  }, [showError]);

  const loadRoutes = useCallback(async () => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    const data = await apiClient<{ routes: Route[]; total: number }>(
      `/admin/routes?${params.toString()}`,
    );
    setRoutes(data.routes);
    setTotal(data.total);
  }, [limit, offset]);

  useEffect(() => {
    if (!accessToken) return;
    void loadCities();
    void loadRoutes();
  }, [accessToken, loadCities, loadRoutes]);

  const syncCities = async () => {
    setSyncingCities(true);

    try {
      const response = await apiClient<{ ok: boolean; count: number }>(
        '/cities/sync',
        { method: 'POST' },
      );
      await loadCities();
      showSuccess(`Đã đồng bộ ${response.count} thành phố từ API.`);
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setSyncingCities(false);
    }
  };

  const updateStopDraftAt = (
    setter: Dispatch<SetStateAction<StopDraft[]>>,
    index: number,
    patch: Partial<StopDraft>,
  ) => {
    setter((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const removeStopDraftAt = (
    setter: Dispatch<SetStateAction<StopDraft[]>>,
    index: number,
  ) => {
    setter((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order: i + 1 })),
    );
  };

  const normalizeStopsDraft = (
    draft: StopDraft[],
    onError: (message: string) => void,
  ): StopPayload[] | null => {
    const normalized: StopPayload[] = [];

    for (let index = 0; index < draft.length; index += 1) {
      const stop = draft[index];

      if (!stop.cityId) {
        onError(`Vui lòng chọn thành phố cho điểm dừng #${index + 1}.`);
        return null;
      }
      if (
        stop.order === '' ||
        !Number.isInteger(stop.order) ||
        stop.order <= 0
      ) {
        onError(`Thứ tự của điểm dừng #${index + 1} không hợp lệ.`);
        return null;
      }
      if (
        stop.estimatedOffsetMinutes === '' ||
        !Number.isInteger(stop.estimatedOffsetMinutes) ||
        stop.estimatedOffsetMinutes < 0
      ) {
        onError(`Độ lệch thời gian của điểm dừng #${index + 1} không hợp lệ.`);
        return null;
      }

      normalized.push({
        ...(stop.id ? { id: stop.id } : {}),
        cityId: Number(stop.cityId),
        type: stop.type,
        order: Number(stop.order),
        estimatedOffsetMinutes: Number(stop.estimatedOffsetMinutes),
      });
    }

    return normalized;
  };

  const autoName = (originId?: number | '', destId?: number | '') => {
    if (!originId || !destId) return '';
    const origin = cities.find((city) => city.id === originId);
    const destination = cities.find((city) => city.id === destId);
    if (!origin || !destination) return '';
    return `${origin.name} - ${destination.name}`;
  };

  const resetForm = () => {
    setForm({
      name: '',
      originCityId: '',
      destinationCityId: '',
      estimatedDurationMinutes: '',
    });
    setCreateStopsDraft([]);
    setEditingId(null);
  };

  const submitRoute = async () => {
    if (
      !form.originCityId ||
      !form.destinationCityId ||
      !form.estimatedDurationMinutes
    ) {
      showError('Vui lòng nhập đủ thông tin tuyến.');
      return;
    }
    if (form.originCityId === form.destinationCityId) {
      showError('Điểm đi và điểm đến không được trùng nhau.');
      return;
    }

    const originCityId = Number(form.originCityId);
    const destinationCityId = Number(form.destinationCityId);
    const estimatedDurationMinutes = Number(form.estimatedDurationMinutes);
    const name =
      form.name || autoName(form.originCityId, form.destinationCityId);

    if (!Number.isFinite(originCityId) || originCityId <= 0) {
      showError('Vui lòng chọn điểm đi hợp lệ.');
      return;
    }
    if (!Number.isFinite(destinationCityId) || destinationCityId <= 0) {
      showError('Vui lòng chọn điểm đến hợp lệ.');
      return;
    }
    if (
      !Number.isFinite(estimatedDurationMinutes) ||
      estimatedDurationMinutes <= 0
    ) {
      showError('Thời gian phải là số phút dương.');
      return;
    }

    const payload: {
      name: string;
      originCityId: number;
      destinationCityId: number;
      estimatedDurationMinutes: number;
      stops?: StopPayload[];
    } = {
      name,
      originCityId,
      destinationCityId,
      estimatedDurationMinutes,
    };

    if (!editingId && createStopsDraft.length > 0) {
      const normalizedStops = normalizeStopsDraft(createStopsDraft, showError);
      if (!normalizedStops) return;
      payload.stops = normalizedStops;
    }

    try {
      if (editingId) {
        await apiClient(`/admin/routes/${editingId}`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await apiClient('/admin/routes', { method: 'POST', body: payload });
      }

      resetForm();
      await loadRoutes();
    } catch (err) {
      showError((err as Error).message);
    }
  };

  const startEdit = (route: Route) => {
    setCreateStopsDraft([]);
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
    const res = await apiClient<RouteStop[]>(`/admin/routes/${routeId}/stops`);
    setStopsDraft(
      res.map((stop) => ({
        id: stop.id,
        cityId: stop.city.id,
        type: stop.type,
        order: stop.order,
        estimatedOffsetMinutes: stop.estimatedOffsetMinutes,
      })),
    );
    setStopsRouteId(routeId);
  };

  const addCreateStopRow = () => {
    setCreateStopsDraft((prev) => [
      ...prev,
      createEmptyStopDraft(prev.length + 1),
    ]);
  };

  const addStopRow = () => {
    setStopsDraft((prev) => [...prev, createEmptyStopDraft(prev.length + 1)]);
  };

  const saveStops = async () => {
    if (!stopsRouteId) return;

    const normalizedStops = normalizeStopsDraft(stopsDraft, showError);
    if (!normalizedStops) return;

    setSavingStops(true);
    try {
      await apiClient(`/admin/routes/${stopsRouteId}/stops`, {
        method: 'POST',
        body: { stops: normalizedStops },
      });

      setStopsRouteId(null);
      setStopsDraft([]);
      await loadRoutes();
    } catch (err) {
      showError((err as Error).message);
    } finally {
      setSavingStops(false);
    }
  };

  const renderStopRows = (
    draft: StopDraft[],
    setter: Dispatch<SetStateAction<StopDraft[]>>,
    emptyText: string,
  ) => {
    if (draft.length === 0) {
      return <div className="text-sm text-gray-400">{emptyText}</div>;
    }

    return (
      <div className="space-y-3">
        {draft.map((stop, idx) => (
          <div
            key={stop.id ?? `new-${idx}`}
            className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_minmax(12rem,1.4fr)_auto] gap-3 items-end"
          >
            <label className="block text-sm text-gray-200">
              <div className="mb-2 font-medium">Thành phố</div>
              <select
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
                value={stop.cityId === '' ? '' : String(stop.cityId)}
                disabled={citiesLoading || cities.length === 0}
                onChange={(e) =>
                  updateStopDraftAt(setter, idx, {
                    cityId: parseSelectNumber(e.target.value),
                  })
                }
              >
                <option value="" style={placeholderOptionStyle}>
                  Chọn thành phố
                </option>
                {cities.map((city) => (
                  <option
                    key={city.id}
                    value={String(city.id)}
                    style={optionTextStyle}
                  >
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-gray-200">
              <div className="mb-2 font-medium">Loại</div>
              <select
                className="h-10 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
                value={stop.type}
                onChange={(e) =>
                  updateStopDraftAt(setter, idx, {
                    type: e.target.value as StopDraft['type'],
                  })
                }
              >
                <option value="PICKUP" style={optionTextStyle}>
                  Đón
                </option>
                <option value="DROPOFF" style={optionTextStyle}>
                  Trả
                </option>
              </select>
            </label>

            <FormField
              label="Thứ tự"
              type="number"
              min={1}
              step={1}
              value={stop.order}
              className="h-10"
              wrapperClassName="!mb-0 min-w-0"
              onChange={(e) =>
                updateStopDraftAt(setter, idx, {
                  order: parseSelectNumber(e.target.value),
                })
              }
            />

            <FormField
              label="Độ lệch thời gian (phút)"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Nhập số phút"
              value={stop.estimatedOffsetMinutes}
              className="h-10"
              wrapperClassName="!mb-0 min-w-0"
              onChange={(e) => {
                if (!/^\d*$/.test(e.target.value)) return;
                updateStopDraftAt(setter, idx, {
                  estimatedOffsetMinutes: parseSelectNumber(e.target.value),
                });
              }}
            />

            <Button
              variant="ghost"
              onClick={() => removeStopDraftAt(setter, idx)}
              className="h-10"
            >
              Xóa
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-center gap-3 xl:grid-cols-[1fr_auto_1fr]">
        <div className="text-center xl:col-start-2">
          <h1 className="text-2xl font-bold text-white">Tuyến đường</h1>
          <p className="text-sm text-gray-400">
            Quản lý các tuyến đường, điểm đi/đến và trạm dừng.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={syncCities}
          loading={syncingCities}
          className="justify-self-center xl:justify-self-end"
        >
          Đồng bộ thành phố
        </Button>
      </div>

      <Card title={editingId ? 'Cập nhật tuyến' : 'Thêm tuyến'}>
        {!citiesLoading && cities.length === 0 ? (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
            Chưa có dữ liệu thành phố nào. Vui lòng bấm "Đồng bộ thành phố" để
            lấy dữ liệu từ API.
          </div>
        ) : null}

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
            onChange={(e) => {
              const value = e.target.value;
              setForm({
                ...form,
                estimatedDurationMinutes: value === '' ? '' : Number(value),
              });
            }}
          />

          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Điểm đi</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.originCityId === '' ? '' : String(form.originCityId)}
              disabled={citiesLoading || cities.length === 0}
              onChange={(e) => {
                const value = parseSelectNumber(e.target.value);
                const newName = autoName(value, form.destinationCityId);
                setForm((prev) => ({
                  ...prev,
                  originCityId: value,
                  name: newName || prev.name,
                }));
              }}
            >
              <option value="" style={placeholderOptionStyle}>
                Chọn thành phố
              </option>
              {cities.map((city) => (
                <option
                  key={city.id}
                  value={String(city.id)}
                  style={optionTextStyle}
                >
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Điểm đến</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={
                form.destinationCityId === ''
                  ? ''
                  : String(form.destinationCityId)
              }
              disabled={citiesLoading || cities.length === 0}
              onChange={(e) => {
                const value = parseSelectNumber(e.target.value);
                const newName = autoName(form.originCityId, value);
                setForm((prev) => ({
                  ...prev,
                  destinationCityId: value,
                  name: newName || prev.name,
                }));
              }}
            >
              <option value="" style={placeholderOptionStyle}>
                Chọn thành phố
              </option>
              {cities.map((city) => (
                <option
                  key={city.id}
                  value={String(city.id)}
                  style={optionTextStyle}
                >
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!editingId ? (
          <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-white">
                  Trạm dừng khi tạo tuyến
                </div>
                <div className="text-sm text-gray-400">
                  Có thể tạo tuyến và danh sách trạm dừng trong cùng một lần
                  lưu.
                </div>
              </div>
              <Button variant="secondary" onClick={addCreateStopRow}>
                Thêm điểm
              </Button>
            </div>

            {renderStopRows(
              createStopsDraft,
              setCreateStopsDraft,
              'Chưa có trạm dừng nào. Nếu đây là tuyến không dừng giữa đường, bạn có thể bỏ qua.',
            )}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button onClick={submitRoute}>
            {editingId ? 'Lưu thay đổi' : 'Tạo tuyến'}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              Hủy
            </Button>
          ) : null}
        </div>
      </Card>

      <Card title="Danh sách tuyến">
        <div className="divide-y divide-white/5 text-sm text-gray-200">
          {routes.map((route) => (
            <div
              key={route.id}
              className="py-3 grid md:grid-cols-5 gap-3 items-center"
            >
              <div>
                <div className="font-semibold text-white">{route.name}</div>
                <div className="text-xs text-gray-400">{route.id}</div>
              </div>
              <div>
                <div className="text-white">{route.originCity.name}</div>
                <div className="text-xs text-gray-400">Đi</div>
              </div>
              <div>
                <div className="text-white">{route.destinationCity.name}</div>
                <div className="text-xs text-gray-400">Đến</div>
              </div>
              <div>{route.estimatedDurationMinutes} phút</div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => startEdit(route)}>
                  Sửa
                </Button>
                <Button variant="secondary" onClick={() => loadStops(route.id)}>
                  Điểm đón/trả
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-400 border-t border-white/5 pt-4">
          <div>
            Hiển thị {offset + 1}-{Math.min(offset + limit, total)} trong tổng
            số {total} tuyến
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Trang trước
            </Button>
            <Button
              variant="secondary"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </Card>

      {stopsRouteId ? (
        <Card title={`Điểm dừng cho tuyến #${stopsRouteId}`}>
          <div className="space-y-4">
            {renderStopRows(
              stopsDraft,
              setStopsDraft,
              'Chưa có điểm dừng nào cho tuyến này.',
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={addStopRow}>
                Thêm điểm
              </Button>
              <Button onClick={saveStops} loading={savingStops}>
                Lưu điểm dừng
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setStopsRouteId(null);
                  setStopsDraft([]);
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
};
