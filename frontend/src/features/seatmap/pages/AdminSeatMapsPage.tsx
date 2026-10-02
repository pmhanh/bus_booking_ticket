import { useToast } from '../../../shared/providers/ToastProvider';
import { useCallback, useEffect, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { SeatMap } from '../types/seatMap';

type SeatCell = {
  id?: number;
  row: number;
  col: number;
  isSeat: boolean;
  isActive: boolean;
  code?: string;
};

const colLetter = (col: number) => String.fromCharCode(64 + col);
const makeCells = (
  rows: number,
  cols: number,
  existingCells: SeatCell[] = [],
  enableNewSeats = true,
): SeatCell[] => {
  const lookup = new Map(
    existingCells.map((cell) => [`${cell.row}-${cell.col}`, cell]),
  );
  const cells: SeatCell[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      cells.push(
        lookup.get(`${row}-${col}`) ?? {
          row,
          col,
          isSeat: enableNewSeats,
          isActive: true,
          code: `${row}${colLetter(col)}`,
        },
      );
    }
  }
  return cells;
};

export const AdminSeatMapsPage = () => {
  const { showError, showSuccess, confirm } = useToast();
  const { accessToken } = useAuth();
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [cells, setCells] = useState<SeatCell[]>(() => makeCells(4, 4));

  const [nameError, setNameError] = useState<string>();

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const busy = saving || deletingId !== null;

  const loadSeatMaps = useCallback(
    () => apiClient<SeatMap[]>('/admin/seat-maps').then(setSeatMaps),
    [],
  );

  const loadSeatMapDetail = useCallback(async (id: number) => {
    const map = await apiClient<SeatMap>(`/admin/seat-maps/${id}`);
    setSelectedId(id);
    setName(map.name);
    setRows(map.rows);
    setCols(map.cols);
    setCells(
      makeCells(
        map.rows,
        map.cols,
        map.seats.map((seat) => ({ ...seat, isSeat: true })),
        false,
      ),
    );
    setNameError(undefined);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void loadSeatMaps().catch((error: Error) =>
      showError(error.message || 'Không thể tải danh sách sơ đồ ghế.'),
    );
  }, [accessToken, loadSeatMaps, showError]);

  const resizeGrid = (nextRows: number, nextCols: number) => {
    setRows(nextRows);
    setCols(nextCols);
    setCells((prev) =>
      makeCells(nextRows, nextCols, prev, selectedId === null),
    );
  };

  const toggleCell = (cell: SeatCell) => {
    const updated: SeatCell = {
      ...cell,
      isSeat: !cell.isSeat,
      code: cell.code || `${cell.row}${colLetter(cell.col)}`,
    };
    setCells((prev) =>
      prev.map((c) => (c.row === cell.row && c.col === cell.col ? updated : c)),
    );
  };

  const resetForm = () => {
    setSelectedId(null);
    setName('');
    setRows(4);
    setCols(4);
    setCells(makeCells(4, 4));

    setNameError(undefined);
  };

  const deleteSeatMap = async (map: SeatMap) => {
    if (busy || (map.busCount ?? 0) > 0) return;
    if (
      !(await confirm({
        message: `Xóa sơ đồ ghế "${map.name}"? Thao tác này không thể hoàn tác.`,
        danger: true,
      }))
    )
      return;
    setDeletingId(map.id);

    try {
      await apiClient(`/admin/seat-maps/${map.id}`, { method: 'DELETE' });
      setSeatMaps((prev) => prev.filter((item) => item.id !== map.id));
      if (selectedId === map.id) resetForm();
      showSuccess('Xóa sơ đồ ghế thành công!');
    } catch (error) {
      showError((error as Error).message || 'Không thể xóa sơ đồ ghế.');
      // Usage can have changed since the list was opened.
      await loadSeatMaps().catch(() => undefined);
    } finally {
      setDeletingId(null);
    }
  };

  const saveSeatMap = async () => {
    if (busy) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Vui lòng nhập tên sơ đồ ghế.');
      return;
    }
    setNameError(undefined);
    const seatsPayload = cells
      .filter((c) => c.isSeat)
      .map((c) => ({
        ...(c.id !== undefined ? { id: c.id } : {}),
        code: c.code || `${c.row}${colLetter(c.col)}`,
        row: c.row,
        col: c.col,
        isActive: c.isActive,
      }));
    if (!seatsPayload.length) {
      showError('Cần chọn ít nhất 1 ghế trước khi lưu sơ đồ.');
      return;
    }
    const payload = { name: trimmedName, rows, cols, seats: seatsPayload };
    setSaving(true);
    try {
      await apiClient(
        selectedId ? `/admin/seat-maps/${selectedId}` : '/admin/seat-maps',
        { method: selectedId ? 'PATCH' : 'POST', body: payload },
      );
      showSuccess(
        selectedId
          ? 'Cập nhật sơ đồ ghế thành công!'
          : 'Tạo sơ đồ ghế thành công!',
      );
      resetForm();
      await loadSeatMaps().catch((error: Error) =>
        showError(error.message || 'Không thể tải danh sách sơ đồ ghế.'),
      );
    } catch (error) {
      showError((error as Error).message || 'Không thể lưu sơ đồ ghế.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Sơ đồ ghế</h1>
          <p className="text-sm text-gray-400">
            Thiết lập bố trí ghế và gán cho xe.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_2fr] gap-4">
        <Card title="Danh sách sơ đồ">
          <div className="space-y-2">
            {seatMaps.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
              >
                <div>
                  <div className="text-white font-semibold">{m.name}</div>
                  <div className="text-xs text-gray-400">
                    {m.rows} x {m.cols} • {m.seats?.length ?? 0} ghế
                  </div>
                  {(m.busCount ?? 0) > 0 && (
                    <div className="text-xs text-amber-300">
                      Đang được {m.busCount} xe sử dụng
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void loadSeatMapDetail(m.id).catch((error: Error) =>
                        showError(error.message || 'Không thể tải sơ đồ ghế.'),
                      )
                    }
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-error disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={busy || (m.busCount ?? 0) > 0}
                    title={
                      (m.busCount ?? 0) > 0
                        ? 'Không thể xóa sơ đồ đang được xe sử dụng'
                        : 'Xóa sơ đồ ghế'
                    }
                    onClick={() => void deleteSeatMap(m)}
                  >
                    {deletingId === m.id ? 'Đang xóa...' : 'Xóa'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title={selectedId ? 'Cập nhật sơ đồ' : 'Tạo sơ đồ mới'}>
          <div className="grid md:grid-cols-2 gap-3">
            <FormField
              label="Tên sơ đồ *"
              required
              value={name}
              error={nameError}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(undefined);
              }}
            />
            <FormField
              label="Số hàng"
              type="number"
              value={rows}
              min={1}
              step={1}
              onChange={(e) =>
                resizeGrid(
                  Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  cols,
                )
              }
            />
            <FormField
              label="Số cột"
              type="number"
              value={cols}
              min={1}
              step={1}
              onChange={(e) =>
                resizeGrid(
                  rows,
                  Math.max(1, Math.floor(Number(e.target.value) || 1)),
                )
              }
            />
          </div>

          <div className="mt-4">
            <p className="mb-3 text-sm text-gray-400">
              Sơ đồ mới mặc định bật tất cả ghế. Nhấn vào một ô để bật hoặc tắt
              ghế.
            </p>
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(40px,1fr))`,
                gap: '8px',
              }}
            >
              {cells.map((cell) => (
                <button
                  key={`${cell.row}-${cell.col}`}
                  aria-pressed={cell.isSeat}
                  className={`h-12 rounded-lg border ${
                    cell.isSeat
                      ? 'bg-secondary border-secondary text-white'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                  onClick={() => toggleCell(cell)}
                >
                  {cell.isSeat
                    ? cell.code
                    : `${cell.row}${colLetter(cell.col)}`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={saveSeatMap} disabled={busy}>
              {saving ? 'Đang lưu...' : selectedId ? 'Lưu sơ đồ' : 'Tạo mới'}
            </Button>
            {selectedId ? (
              <Button variant="secondary" disabled={busy} onClick={resetForm}>
                Thoát
              </Button>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
};
