import { useMemo } from 'react';
import clsx from 'clsx';
import type {
  SeatAvailability,
  SeatWithState,
} from '../../seatmap/types/seatMap';
import { busTypeLabel } from '../../../shared/utils/displayLabels';

type SeatMapViewProps = {
  seatMap: SeatAvailability['seatMap'];
  seats: SeatWithState[];
  selected: string[];
  onToggle: (seat: SeatWithState) => void;
  disabled?: boolean;
  basePrice?: number;
  busType?: string;
};

export const SeatMapView = ({
  seatMap,
  seats,
  selected,
  onToggle,
  disabled = false,
  basePrice,
  busType,
}: SeatMapViewProps) => {
  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatWithState>();
    seats.forEach((s) => map.set(`${s.row}-${s.col}`, s));
    return map;
  }, [seats]);

  const cells = [];
  for (let i = 1; i <= seatMap.rows; i++) {
    for (let j = 1; j <= seatMap.cols; j++) {
      const seat = seatLookup.get(`${i}-${j}`);
      if (!seat) {
        cells.push(
          <div
            key={`${i}-${j}`}
            className="h-14 rounded-xl border border-dashed border-white/10 bg-white/5"
          />,
        );
        continue;
      }

      const isSelected = selected.includes(seat.code);
      const isBooked = seat.status === 'booked';
      const isHeld = seat.status === 'held';
      const isDisabled =
        isBooked || isHeld || seat.status === 'inactive' || disabled;
      const statusClass =
        seat.status === 'inactive'
          ? 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed'
          : isBooked
            ? 'bg-rose-600/70 border-rose-300/60 text-white cursor-not-allowed'
            : isHeld
              ? 'bg-amber-600/70 border-amber-200/70 text-white cursor-not-allowed'
              : isSelected
                ? 'bg-emerald-200 border-emerald-100 text-emerald-950 ring-2 ring-emerald-200 shadow-lg shadow-emerald-300/30 scale-[1.02]'
                : 'bg-gradient-to-br from-emerald-500/70 to-teal-500/70 border-emerald-200/60 text-white';

      cells.push(
        <button
          key={`${i}-${j}`}
          type="button"
          className={clsx(
            'h-14 rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition-all duration-150 focus:outline-none',
            statusClass,
          )}
          disabled={isDisabled}
          aria-pressed={isSelected}
          onClick={() => onToggle(seat)}
        >
          <span className="leading-none">{seat.code}</span>
          <span className="text-[11px] font-medium opacity-80">
            {(seat.price ?? basePrice ?? 0).toLocaleString('vi-VN')}đ
          </span>
        </button>,
      );
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-300">
        Loại ghế / xe: {busTypeLabel(busType)}
      </p>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${seatMap.cols}, minmax(0,1fr))`,
          gap: '10px',
        }}
      >
        {cells}
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <LegendChip
            color="bg-emerald-500/80 border-white/10 text-white/90"
            label="Còn trống"
          />
          <LegendChip
            color="bg-emerald-200 border-emerald-100 text-emerald-950"
            label="Đang chọn"
          />
          <LegendChip
            color="bg-amber-600/80 border-white/10 text-white/90"
            label="Đang giữ"
          />
          <LegendChip
            color="bg-rose-600/80 border-white/10 text-white/90"
            label="Đã đặt"
          />
          <LegendChip
            color="bg-slate-500/60 border-white/10 text-white/90"
            label="Không hoạt động"
          />
        </div>
      </div>
    </div>
  );
};

const LegendChip = ({ color, label }: { color: string; label: string }) => (
  <span
    className={clsx(
      'px-3 py-1 rounded-full text-[11px] uppercase tracking-wide border',
      color,
    )}
  >
    {label}
  </span>
);
