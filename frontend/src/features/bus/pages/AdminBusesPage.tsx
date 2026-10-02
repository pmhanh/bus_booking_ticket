import {
  optionTextStyle,
  placeholderOptionStyle,
  parseSelectNumber,
} from '../../../shared/utils/select';
import { useToast } from '../../../shared/providers/ToastProvider';
import {
  busTypeLabel,
  busTypeOptions,
  amenityLabel,
  amenityOptions,
} from '../../../shared/utils/displayLabels';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import { BusPhotoUpload } from '../components/BusPhotoUpload';
import type { Bus } from '../types/bus';
import type { SeatMap } from '../../seatmap/types/seatMap';

type BusForm = {
  id?: number;
  name: string;
  plateNumber: string;
  busType?: string;
  amenities?: string[];
  seatMapId: number | '';
};

export const AdminBusesPage = () => {
  const { showError, showSuccess, confirm } = useToast();
  const { accessToken } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [form, setForm] = useState<BusForm>({
    name: '',
    plateNumber: '',
    busType: 'SEATER',
    seatMapId: '',
    amenities: [],
  });

  const [filters, setFilters] = useState<{
    busType?: string;
    seatMapId?: number | '';
  }>({});

  const loadBuses = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await apiClient<Bus[]>('/admin/buses');
      setBuses(res);
    } catch (err) {
      showError((err as Error).message || 'Không thể tải danh sách xe.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, showError]);

  const loadSeatMaps = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await apiClient<SeatMap[]>('/admin/seat-maps');
      setSeatMaps(res);
    } catch (err) {
      showError((err as Error).message || 'Không thể tải danh sách sơ đồ ghế.');
    }
  }, [accessToken, showError]);

  useEffect(() => {
    void loadBuses();
    void loadSeatMaps();
  }, [loadBuses, loadSeatMaps]);

  const resetForm = () => {
    setForm({
      name: '',
      plateNumber: '',
      busType: 'SEATER',
      seatMapId: '',
      amenities: [],
    });
  };

  const submitBus = async () => {
    if (savingRef.current) return;

    const name = form.name.trim();
    const plateNumber = form.plateNumber.trim().toUpperCase();
    if (!name || !plateNumber || form.seatMapId === '') {
      showError('Vui lòng nhập tên xe, biển số và chọn sơ đồ ghế.');
      return;
    }

    if (
      buses.some(
        (bus) =>
          bus.id !== form.id &&
          bus.plateNumber.trim().toUpperCase() === plateNumber,
      )
    ) {
      showError(`Biển số ${plateNumber} đã được sử dụng bởi xe khác.`);
      return;
    }

    const payload = {
      name,
      plateNumber,
      busType: form.busType,
      seatMapId: Number(form.seatMapId),
      amenities: form.amenities || [],
    };

    savingRef.current = true;
    setSaving(true);
    try {
      if (form.id) {
        await apiClient(`/admin/buses/${form.id}`, {
          method: 'PATCH',
          body: payload,
        });
      } else {
        await apiClient<Bus>('/admin/buses', { method: 'POST', body: payload });
      }
      resetForm();
      showSuccess(form.id ? 'Cập nhật xe thành công!' : 'Tạo xe thành công!');
      await loadBuses();
    } catch (err) {
      showError((err as Error).message || 'Không thể lưu xe');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const startEdit = (bus: Bus) => {
    if (savingRef.current) return;
    setForm({
      id: bus.id,
      name: bus.name,
      plateNumber: bus.plateNumber,
      busType: bus.busType || 'SEATER',
      seatMapId: bus.seatMap?.id || '',
      amenities: bus.amenities || [],
    });
  };

  const deleteBus = async (id: number) => {
    if (savingRef.current) return;
    if (
      !(await confirm({
        message: 'Xóa xe này? Hành động này không thể hoàn tác!',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient(`/admin/buses/${id}`, { method: 'DELETE' });
      showSuccess('Xóa xe thành công!');
      void loadBuses();
    } catch (err) {
      showError((err as Error).message || 'Không thể xóa xe');
    }
  };

  const filteredBuses = buses.filter((bus) => {
    if (filters.busType && bus.busType !== filters.busType) return false;
    if (filters.seatMapId && bus.seatMap?.id !== filters.seatMapId)
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Quản lý xe</h1>
          <p className="text-sm text-gray-400">
            Tạo, chỉnh sửa và quản lý xe buýt.
          </p>
        </div>
      </div>

      <Card title={form.id ? 'Cập nhật xe' : 'Thêm xe mới'}>
        <fieldset disabled={saving} className="grid md:grid-cols-3 gap-4">
          <FormField
            label="Tên xe"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="VD: Xe VIP 01"
          />
          <FormField
            label="Biển số"
            value={form.plateNumber}
            onChange={(e) => setForm({ ...form, plateNumber: e.target.value })}
            placeholder="VD: 51A-12345"
          />

          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Loại ghế / xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.busType}
              onChange={(e) => setForm({ ...form, busType: e.target.value })}
            >
              {busTypeOptions.map(({ value, label }) => (
                <option key={value} value={value} style={optionTextStyle}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Sơ đồ ghế</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.seatMapId === '' ? '' : String(form.seatMapId ?? '')}
              onChange={(e) => {
                const value = parseSelectNumber(e.target.value);
                setForm({ ...form, seatMapId: value });
              }}
            >
              <option value="" disabled style={placeholderOptionStyle}>
                Chưa gán
              </option>
              {seatMaps.map((m) => (
                <option key={m.id} value={String(m.id)} style={optionTextStyle}>
                  {m.name} ({m.rows}x{m.cols})
                </option>
              ))}
            </select>
          </label>
          <fieldset className="md:col-span-3 min-w-0">
            <legend className="mb-2 text-sm font-medium text-gray-200">
              Tiện ích trên xe
            </legend>
            <p className="mb-3 text-xs text-gray-400">
              Chọn các tiện ích xe cung cấp cho hành khách.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {amenityOptions.map(({ value, label }) => {
                const checked = (form.amenities ?? []).some(
                  (item) => amenityLabel(item) === label,
                );
                return (
                  <label
                    key={value}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-sm cursor-pointer ${checked ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/5 text-gray-200'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="h-4 w-4 shrink-0 accent-emerald-500"
                      onChange={(event) => {
                        const enabled = event.target.checked;
                        setForm((previous) => {
                          // Treat existing aliases (e.g. WATER/DRINKING_WATER) as one option.
                          const remaining = (previous.amenities ?? []).filter(
                            (item) => amenityLabel(item) !== label,
                          );
                          return {
                            ...previous,
                            amenities: enabled
                              ? [...remaining, value]
                              : remaining,
                          };
                        });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </fieldset>

        <div className="mt-4 flex gap-2">
          <Button onClick={submitBus} disabled={saving}>
            {saving ? 'Đang lưu...' : form.id ? 'Cập nhật' : 'Tạo xe'}
          </Button>
          <Button variant="secondary" onClick={resetForm} disabled={saving}>
            {form.id ? 'Hủy' : 'Xóa'}
          </Button>
        </div>
      </Card>

      <Card title="Bộ lọc">
        <div className="grid md:grid-cols-3 gap-4">
          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Loại xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={filters.busType ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  busType: e.target.value || undefined,
                }))
              }
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {busTypeOptions.map(({ value, label }) => (
                <option key={value} value={value} style={optionTextStyle}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-gray-200">
            <div className="mb-2 font-medium">Sơ đồ ghế</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={
                filters.seatMapId === '' || filters.seatMapId == null
                  ? ''
                  : String(filters.seatMapId)
              }
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  seatMapId: parseSelectNumber(e.target.value),
                }))
              }
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
              {seatMaps.map((m) => (
                <option key={m.id} value={String(m.id)} style={optionTextStyle}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card
        title={
          loading ? 'Đang tải...' : `Danh sách xe (${filteredBuses.length})`
        }
      >
        <div className="grid grid-cols-6 gap-3 text-xs uppercase text-gray-400 border-b border-white/5 pb-2">
          <div>Tên xe</div>
          <div>Biển số</div>
          <div>Loại xe</div>
          <div>Sơ đồ ghế</div>
          <div>Tiện ích</div>
          <div className="text-right">Thao tác</div>
        </div>
        <div className="divide-y divide-white/5 text-sm text-gray-200">
          {filteredBuses.length === 0 ? (
            <div className="py-8 text-center text-gray-400">Chưa có xe nào</div>
          ) : (
            filteredBuses.map((bus) => (
              <div key={bus.id} className="py-3">
                <div className="grid grid-cols-6 gap-3 items-center">
                  <div className="text-white font-semibold">{bus.name}</div>
                  <div className="text-gray-200">{bus.plateNumber}</div>
                  <div>
                    <span className="inline-flex px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                      {busTypeLabel(bus.busType)}
                    </span>
                  </div>
                  <div className="text-gray-200">
                    {bus.seatMap ? (
                      <span>
                        {bus.seatMap.name} ({bus.seatMap.rows}x
                        {bus.seatMap.cols})
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">Chưa gán</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {bus.amenities && bus.amenities.length > 0
                      ? bus.amenities.map(amenityLabel).join(', ')
                      : 'Không có'}
                  </div>
                  <div className="text-right space-x-2">
                    <Button variant="secondary" onClick={() => startEdit(bus)}>
                      Sửa
                    </Button>
                    <Button variant="ghost" onClick={() => deleteBus(bus.id)}>
                      Xóa
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pl-4 border-l-2 border-white/10">
                  <div className="text-xs uppercase text-gray-400 mb-2">
                    Ảnh xe
                  </div>
                  {accessToken && (
                    <BusPhotoUpload
                      busId={bus.id}
                      photos={bus.photos || []}
                      onPhotoChange={loadBuses}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
