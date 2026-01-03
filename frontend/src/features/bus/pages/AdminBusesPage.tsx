import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { Bus } from '../types/bus';
import type { SeatMap } from '../../seatmap/types/seatMap';

type BusForm = {
  id?: number;
  name: string;
  plateNumber: string;
  busType?: string;
  amenities?: string[];
  seatMapId?: number | '';
};

const optionTextStyle: React.CSSProperties = { color: '#111' };
const placeholderOptionStyle: React.CSSProperties = { color: '#666' };

const parseSelectNumber = (value: string): number | '' => {
  if (value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
};

export const AdminBusesPage = () => {
  const { accessToken } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<BusForm>({
    name: '',
    plateNumber: '',
    busType: 'STANDARD',
    seatMapId: '',
    amenities: [],
  });

  const [filters, setFilters] = useState<{
    busType?: string;
    seatMapId?: number | '';
  }>({});

  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  const loadBuses = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await apiClient<Bus[]>('/admin/buses', { headers });
      setBuses(res);
    } catch (err) {
      console.error('Failed to load buses:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, headers]);

  const loadSeatMaps = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await apiClient<SeatMap[]>('/admin/seat-maps', { headers });
      setSeatMaps(res);
    } catch (err) {
      console.error('Failed to load seat maps:', err);
    }
  }, [accessToken, headers]);

  useEffect(() => {
    void loadBuses();
    void loadSeatMaps();
  }, [loadBuses, loadSeatMaps]);

  const resetForm = () => {
    setForm({
      name: '',
      plateNumber: '',
      busType: 'STANDARD',
      seatMapId: '',
      amenities: [],
    });
    setMessage('');
  };

  const submitBus = async () => {
    setMessage('');

    if (!form.name || !form.plateNumber) {
      setMessage('Vui lòng nhập tên xe và biển số.');
      return;
    }

    const payload = {
      name: form.name,
      plateNumber: form.plateNumber,
      busType: form.busType,
      seatMapId: form.seatMapId ? Number(form.seatMapId) : undefined,
      amenities: form.amenities || [],
    };

    try {
      if (form.id) {
        await apiClient(`/admin/buses/${form.id}`, {
          method: 'PATCH',
          headers,
          body: payload,
        });
        setMessage('Cập nhật xe thành công!');
      } else {
        await apiClient<Bus>('/admin/buses', {
          method: 'POST',
          headers,
          body: payload,
        });
        setMessage('Tạo xe thành công!');
      }
      resetForm();
      void loadBuses();
    } catch (err) {
      setMessage((err as Error).message || 'Không thể lưu xe');
    }
  };

  const startEdit = (bus: Bus) => {
    setForm({
      id: bus.id,
      name: bus.name,
      plateNumber: bus.plateNumber,
      busType: bus.busType || 'STANDARD',
      seatMapId: bus.seatMap?.id || '',
      amenities: bus.amenities || [],
    });
  };

  const deleteBus = async (id: number) => {
    if (!window.confirm('Xóa xe này? Hành động này không thể hoàn tác!')) return;
    try {
      await apiClient(`/admin/buses/${id}`, { method: 'DELETE', headers });
      setMessage('Xóa xe thành công!');
      void loadBuses();
    } catch (err) {
      setMessage((err as Error).message || 'Không thể xóa xe');
    }
  };

  const filteredBuses = buses.filter((bus) => {
    if (filters.busType && bus.busType !== filters.busType) return false;
    if (filters.seatMapId && bus.seatMap?.id !== filters.seatMapId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Quản lý xe</h1>
          <p className="text-sm text-gray-400">Tạo, chỉnh sửa và quản lý xe buýt.</p>
        </div>
      </div>

      <Card title={form.id ? 'Cập nhật xe' : 'Thêm xe mới'}>
        <div className="grid md:grid-cols-3 gap-4">
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
            <div className="mb-2 font-medium">Loại xe</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.busType}
              onChange={(e) => setForm({ ...form, busType: e.target.value })}
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
            <div className="mb-2 font-medium">Sơ đồ ghế</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={form.seatMapId === '' ? '' : String(form.seatMapId ?? '')}
              onChange={(e) => {
                const value = parseSelectNumber(e.target.value);
                setForm({ ...form, seatMapId: value });
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

        {message ? (
          <div
            className={`text-sm mt-3 px-3 py-2 rounded-lg ${
              message.includes('thành công')
                ? 'text-green-300 bg-green-600/20 border border-green-600/30'
                : 'text-error bg-error/10 border border-error/30'
            }`}
          >
            {message}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button onClick={submitBus}>{form.id ? 'Cập nhật' : 'Tạo xe'}</Button>
          <Button variant="secondary" onClick={resetForm}>
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
              onChange={(e) => setFilters((f) => ({ ...f, busType: e.target.value || undefined }))}
            >
              <option value="" style={placeholderOptionStyle}>
                Tất cả
              </option>
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
            <div className="mb-2 font-medium">Sơ đồ ghế</div>
            <select
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-gray-200"
              value={filters.seatMapId === '' || filters.seatMapId == null ? '' : String(filters.seatMapId)}
              onChange={(e) => setFilters((f) => ({ ...f, seatMapId: parseSelectNumber(e.target.value) }))}
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

      <Card title={loading ? 'Đang tải...' : `Danh sách xe (${filteredBuses.length})`}>
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
              <div key={bus.id} className="grid grid-cols-6 gap-3 py-3 items-center">
                <div className="text-white font-semibold">{bus.name}</div>
                <div className="text-gray-200">{bus.plateNumber}</div>
                <div>
                  <span className="inline-flex px-2 py-1 rounded-full text-xs bg-primary/20 text-primary">
                    {bus.busType || 'N/A'}
                  </span>
                </div>
                <div className="text-gray-200">
                  {bus.seatMap ? (
                    <span>
                      {bus.seatMap.name} ({bus.seatMap.rows}x{bus.seatMap.cols})
                    </span>
                  ) : (
                    <span className="text-gray-500 italic">Chưa gán</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {bus.amenities && bus.amenities.length > 0 ? bus.amenities.join(', ') : 'Không có'}
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
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
