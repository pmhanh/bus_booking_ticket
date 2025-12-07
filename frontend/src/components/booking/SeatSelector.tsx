import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { SeatStatus } from '../../types/booking';
import { getSeatStatus } from '../../api/bookings';

type Props = {
  tripId: number;
  selected: string[];
  onToggle: (seat: SeatStatus) => void;
};

export const SeatSelector = ({ tripId, selected, onToggle }: Props) => {
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [meta, setMeta] = useState<{ rows: number; cols: number; name?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getSeatStatus(tripId)
      .then((res) => {
        setSeats(res.seats || []);
        setMeta(res.seatMap ? { rows: res.seatMap.rows, cols: res.seatMap.cols, name: res.seatMap.name } : null);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Unable to fetch seats'))
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 6000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Deduplicate by seat code to avoid duplicate keys and double-add selections
  const seatGrid = useMemo(() => {
    const map = new Map<string, SeatStatus>();
    seats.forEach((s) => {
      if (!map.has(s.code)) map.set(s.code, s);
    });
    return Array.from(map.values());
  }, [seats]);

  const rows = useMemo(() => meta?.rows || Math.max(0, ...seatGrid.map((s) => s.row)), [meta?.rows, seatGrid]);
  const cols = useMemo(() => meta?.cols || Math.max(0, ...seatGrid.map((s) => s.col)), [meta?.cols, seatGrid]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-gray-400">Sơ đồ ghế</span>
          {meta?.name ? <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs">{meta.name}</span> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Legend color="bg-emerald-500/80 border-emerald-300/80" label="Trống" />
          <Legend color="bg-white border-white/80 text-gray-900" label="Đang giữ" />
          <Legend color="bg-gray-600 border-gray-400" label="Đã bán" />
          <Legend color="bg-primary border-primary text-white" label="Đã chọn" />
        </div>
      </div>

      {loading ? <div className="text-sm text-gray-300">Đang tải trạng thái ghế...</div> : null}
      {error ? <div className="text-sm text-red-200">{error}</div> : null}

      {seats.length ? (
        <div
          className="grid gap-2 bg-white/5 border border-white/10 rounded-2xl p-4"
          style={{
            gridTemplateColumns: `repeat(${Math.max(cols, 1)}, minmax(48px, 1fr))`,
            gridTemplateRows: `repeat(${Math.max(rows, 1)}, auto)`,
          }}
        >
          {seatGrid.map((seat) => {
            const isSelected = selected.includes(seat.code);
            const disabled = (!isSelected && seat.status !== 'available') || seat.isActive === false;
            const tone =
              seat.status === 'booked'
                ? 'bg-gray-600 border-gray-400 text-gray-200'
                : seat.status === 'reserved'
                  ? 'bg-white border-white/80 text-gray-900'
                  : 'bg-emerald-600/80 border-emerald-300/70 text-white';
            return (
              <button
                key={`${seat.code}-${seat.row}-${seat.col}`}
                disabled={disabled}
                onClick={() => onToggle(seat)}
                style={{ gridColumn: seat.col, gridRow: seat.row }}
                className={clsx(
                  'h-14 rounded-xl border text-sm font-semibold transition-all flex flex-col items-center justify-center relative',
                  tone,
                  isSelected ? 'ring-2 ring-primary shadow-lg bg-primary/90 text-white' : null,
                  disabled ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-card',
                )}
              >
                <span>{seat.code}</span>
                <span className="text-[11px] font-normal opacity-80">{seat.price.toLocaleString()} đ</span>
                {seat.status !== 'available' && !isSelected ? (
                  <span className="absolute top-1 right-1 text-[10px] uppercase font-semibold opacity-80">
                    {seat.status === 'booked' ? 'Sold' : 'Hold'}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-300">Chưa có sơ đồ ghế cho chuyến này.</div>
      )}
    </div>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className={clsx('h-3 w-3 rounded-full border', color)} />
    {label}
  </span>
);
