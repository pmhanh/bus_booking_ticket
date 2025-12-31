import { useMemo } from 'react';
import clsx from 'clsx';
import type { SeatAvailability, SeatWithState } from '../../seatmap/types/seatMap';

const seatTypeStyles: Record<
  string,
  { label: string; bg: string; border: string; text?: string }
> = {
  standard: {
    label: 'Tiêu chuẩn',
    bg: 'from-emerald-500/70 to-teal-500/70',
    border: 'border-emerald-200/60',
  },
  vip: {
    label: 'VIP',
    bg: 'from-amber-500/80 to-pink-500/70',
    border: 'border-amber-200/80',
  },
  double: {
    label: 'Đôi',
    bg: 'from-sky-500/70 to-indigo-500/70',
    border: 'border-sky-200/80',
  },
  sleeper: {
    label: 'Giường nằm',
    bg: 'from-purple-500/70 to-violet-500/70',
    border: 'border-purple-200/80',
  },
};

type SeatMapViewProps = {
  seatMap: SeatAvailability['seatMap'];
  seats: SeatWithState[];
  selected: string[];
  onToggle: (seat: SeatWithState) => void;
  maxSelectable?: number;
  basePrice?: number;
};

export const SeatMapView = ({
  seatMap,
  seats,
  selected,
  onToggle,
  maxSelectable,
  basePrice,
}: SeatMapViewProps) => {
  const seatLookup = useMemo(() => {
    const map = new Map<string, SeatWithState>();
    seats.forEach((s) => map.set(`${s.row}-${s.col}`, s));
    return map;
  }, [seats]);

  const limitReached = maxSelectable !== undefined && selected.length >= maxSelectable;

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
        isBooked ||
        isHeld ||
        seat.status === 'inactive' ||
        (limitReached && !isSelected);
      const palette = seatTypeStyles[seat.seatType || 'standard'] || seatTypeStyles.standard;
      const statusClass =
        seat.status === 'inactive'
          ? 'bg-white/5 border-white/10 text-gray-600 cursor-not-allowed'
          : isBooked
            ? 'bg-rose-600/70 border-rose-300/60 text-white cursor-not-allowed'
            : isHeld
              ? 'bg-amber-600/70 border-amber-200/70 text-white cursor-not-allowed'
            : clsx(
                `bg-gradient-to-br ${palette.bg} border ${palette.border} text-white`,
                isSelected ? 'ring-2 ring-emerald-200 shadow-xl scale-[1.02]' : '',
              );

      cells.push(
        <button
          key={`${i}-${j}`}
          className={clsx(
            'h-14 rounded-xl border text-sm font-semibold flex flex-col items-center justify-center transition-all duration-150 focus:outline-none',
            statusClass,
            limitReached && !isSelected && seat.status === 'available'
              ? 'opacity-60 cursor-not-allowed'
              : '',
          )}
          disabled={isDisabled}
          onClick={() => onToggle(seat)}
        >
          <span className="leading-none">{seat.code}</span>
          <span className="text-[11px] font-medium opacity-80">
            {(seat.price ?? basePrice ?? 0).toLocaleString()}đ
          </span>
        </button>,
      );
    }
  }

  return (
    <div className="space-y-4">
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
          <LegendChip color="bg-emerald-500/80" label="Available" />
          <LegendChip color="bg-emerald-200/80 border border-emerald-200/70 text-emerald-950" label="Selected" />
          <LegendChip color="bg-amber-600/80" label="Held" />
          <LegendChip color="bg-rose-600/80" label="Booked" />
          <LegendChip color="bg-slate-500/60" label="Inactive" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(seatTypeStyles).map(([key, value]) => (
            <LegendChip key={key} color={`bg-gradient-to-r ${value.bg}`} label={value.label} />
          ))}
        </div>
      </div>
    </div>
  );
};

const LegendChip = ({ color, label }: { color: string; label: string }) => (
  <span
    className={clsx(
      'px-3 py-1 rounded-full text-[11px] uppercase tracking-wide border border-white/10 text-white/90',
      color,
    )}
  >
    {label}
  </span>
);
