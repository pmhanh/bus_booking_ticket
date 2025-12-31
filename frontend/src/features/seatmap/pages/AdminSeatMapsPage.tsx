import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { FormField } from '../../../shared/components/ui/FormField';
import { apiClient } from '../../../shared/api/api';
import { useAuth } from '../../auth/context/AuthContext';
import type { SeatMap } from '../types/seatMap';

type SeatCell = {
  row: number;
  col: number;
  isSeat: boolean;
  code?: string;
  seatType?: string;
};

const colLetter = (col: number) => String.fromCharCode(64 + col);
const SEAT_TYPES = [
  { value: 'standard', label: 'Tiêu chuẩn' },
  { value: 'vip', label: 'VIP' },
  { value: 'double', label: 'Đôi' },
  { value: 'sleeper', label: 'Giường nằm' },
];

export const AdminSeatMapsPage = () => {
  const { accessToken } = useAuth();
  const [seatMaps, setSeatMaps] = useState<SeatMap[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  const [cells, setCells] = useState<SeatCell[]>([]);
  const [selectedCell, setSelectedCell] = useState<SeatCell | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${accessToken}` }), [accessToken]);

  const makeCells = useCallback(
    (r: number, c: number, seats?: SeatMap['seats']) => {
      const lookup = new Map<
        string,
        { code: string; price: number; isActive: boolean; seatType?: string }
      >();
      seats?.forEach((s) =>
        lookup.set(`${s.row}-${s.col}`, {
          code: s.code,
          isActive: s.isActive,
          seatType: s.seatType || 'SEATER',
        }),
      );
      const next: SeatCell[] = [];
      for (let i = 1; i <= r; i++) {
        for (let j = 1; j <= c; j++) {
          const key = `${i}-${j}`;
          const found = lookup.get(key);
          next.push({
            row: i,
            col: j,
            isSeat: found ? found.isActive !== false : true,
            code: found?.code ?? `${i}${colLetter(j)}`,
            seatType: found?.seatType ?? 'standard',
          });
        }
      }
      setCells(next);
    },
    [],
  );

  const loadSeatMaps = useCallback(
    () => apiClient<SeatMap[]>('/admin/seat-maps', { headers }).then(setSeatMaps),
    [headers],
  );

  const loadSeatMapDetail = useCallback(
    async (id: number) => {
      const map = await apiClient<SeatMap>(`/admin/seat-maps/${id}`, { headers });
      setSelectedId(id);
      setName(map.name);
      setRows(map.rows);
      setCols(map.cols);
      makeCells(map.rows, map.cols, map.seats);
    },
    [headers, makeCells],
  );

  useEffect(() => {
    if (!accessToken) return;
    loadSeatMaps();
    makeCells(rows, cols);
  }, [accessToken, loadSeatMaps, makeCells, rows, cols]);

  useEffect(() => {
    setCells((prev) => {
      const seats = selectedId
        ? prev
            .filter((c) => c.isSeat)
            .map((s) => ({
              code: s.code || `${s.row}${colLetter(s.col)}`,
              row: s.row,
              col: s.col,
              seatType: s.seatType || 'standard',
              isActive: true,
            })) as SeatMap['seats']
        : undefined;
      const lookup = new Map<
        string,
        { code: string; price: number; isActive: boolean; seatType?: string }
      >();
      seats?.forEach((s) =>
        lookup.set(`${s.row}-${s.col}`, {
          code: s.code,
          isActive: s.isActive,
          seatType: s.seatType || 'SEATER',
        }),
      );
      const next: SeatCell[] = [];
      for (let i = 1; i <= rows; i++) {
        for (let j = 1; j <= cols; j++) {
          const key = `${i}-${j}`;
          const found = lookup.get(key);
          next.push({
            row: i,
            col: j,
            isSeat: found ? found.isActive !== false : true,
            code: found?.code ?? `${i}${colLetter(j)}`,
            seatType: found?.seatType ?? 'standard',
          });
        }
      }
      return next;
    });
  }, [rows, cols, selectedId]);

  const toggleCell = (cell: SeatCell) => {
    let nextSelected: SeatCell | null = null;
    setCells((prev) =>
      prev.map((c) => {
        if (c.row === cell.row && c.col === cell.col) {
          const isSeat = !c.isSeat;
          const updated: SeatCell = {
            ...c,
            isSeat,
            code: isSeat ? c.code || `${c.row}${colLetter(c.col)}` : undefined,
            seatType: isSeat ? c.seatType || 'standard' : undefined,
          };
          nextSelected = isSeat ? updated : null;
          return updated;
        }
        return c;
      }),
    );
    setSelectedCell(nextSelected);
  };

  const updateSelectedSeatType = (seatType: string) => {
    setCells((prev) =>
      prev.map((c) => {
        if (selectedCell && c.row === selectedCell.row && c.col === selectedCell.col) {
          return { ...c, seatType };
        }
        return c;
      }),
    );
    setSelectedCell((prev) => (prev ? { ...prev, seatType } : prev));
  };

  const saveSeatMap = async () => {
    setSaveError(null);
    const seatsPayload = cells
      .filter((c) => c.isSeat)
      .map((c) => ({
        code: c.code || `${c.row}${colLetter(c.col)}`,
        row: c.row,
        col: c.col,
        seatType: c.seatType || 'standard',
        isActive: true,
      }));
    if (!seatsPayload.length) {
      setSaveError('Cần chọn ít nhất 1 ghế trước khi lưu sơ đồ.');
      return;
    }
    const payload = { name, rows, cols, seats: seatsPayload };
    if (selectedId) {
      await apiClient(`/admin/seat-maps/${selectedId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
    } else {
      await apiClient('/admin/seat-maps', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    }
    setSelectedId(null);
    setName('');
    setRows(4);
    setCols(4);
    setSelectedCell(null);
    makeCells(4, 4);
    loadSeatMaps();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sơ đồ ghế</h1>
          <p className="text-sm text-gray-400">Thiết lập layout ghế và gán cho xe.</p>
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
                </div>
                <Button variant="secondary" onClick={() => loadSeatMapDetail(m.id)}>
                  Sửa
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card title={selectedId ? 'Cập nhật sơ đồ' : 'Tạo sơ đồ mới'}>
          <div className="grid md:grid-cols-2 gap-3">
            <FormField label="Tên sơ đồ" value={name} onChange={(e) => setName(e.target.value)} />
            <FormField
              label="Số hàng"
              type="number"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value) || 1)}
            />
            <FormField
              label="Số cột"
              type="number"
              value={cols}
              onChange={(e) => setCols(Number(e.target.value) || 1)}
            />
          </div>

          <div className="mt-4">
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(40px,1fr))`, gap: '8px' }}>
              {cells.map((cell) => (
                <button
                  key={`${cell.row}-${cell.col}`}
                  className={`h-12 rounded-lg border ${
                    cell.isSeat ? 'bg-secondary border-secondary text-white' : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                  onClick={() => toggleCell(cell)}
                >
                  {cell.isSeat ? cell.code : `${cell.row}${colLetter(cell.col)}`}
                </button>
            ))}
          </div>
          {selectedCell ? (
            <div className="mt-3 grid sm:grid-cols-[1fr_1fr] gap-3 items-end">
              <div className="text-sm text-gray-200">
                Ghế {selectedCell.row}
                {colLetter(selectedCell.col)}
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Loại ghế</label>
                <select
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none"
                  value={
                    cells.find((c) => c.row === selectedCell.row && c.col === selectedCell.col)?.seatType ||
                    'standard'
                  }
                  onChange={(e) => updateSelectedSeatType(e.target.value)}
                >
                  {SEAT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-400">Chọn 1 ghế để chỉnh loại ghế.</div>
          )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={saveSeatMap}>{selectedId ? 'Lưu sơ đồ' : 'Tạo mới'}</Button>
            {selectedId ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedId(null);
                  setName('');
                  setRows(4);
                  setCols(4);
                  setSelectedCell(null);
                  makeCells(4, 4);
                }}
              >
                Làm mới
              </Button>
            ) : null}
            {saveError ? <div className="text-sm text-error">{saveError}</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
};
