import React, { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';

type Props = {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (next: [number, number]) => void;
  disabled?: boolean;
  className?: string;
};

export const RangeSlider: React.FC<Props> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled,
  className,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeThumb, setActiveThumb] = useState<0 | 1 | null>(null);

  const clamp = (v: number) => Math.min(Math.max(v, min), max);
  const percent = (v: number) => ((clamp(v) - min) / (max - min)) * 100;

  const [from, to] = value;

  const getValueFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return from;

      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      const snapped =
        Math.round((raw - min) / step) * step + min;

      return clamp(snapped);
    },
    [min, max, step, from],
  );

  useEffect(() => {
    if (activeThumb === null || disabled) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (disabled) return;
      let clientX: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        e.preventDefault(); // tránh scroll khi kéo
      } else {
        clientX = e.clientX;
      }

      const v = getValueFromClientX(clientX);

      if (activeThumb === 0) {
        const nextFrom = Math.min(v, to);
        onChange([nextFrom, to]);
      } else {
        const nextTo = Math.max(v, from);
        onChange([from, nextTo]);
      }
    };

    const handleUp = () => {
      setActiveThumb(null);
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };

    window.addEventListener('mousemove', handleMove as any);
    window.addEventListener('touchmove', handleMove as any, { passive: false } as any);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove as any);
      window.removeEventListener('touchmove', handleMove as any);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [activeThumb, disabled, from, to, getValueFromClientX, onChange]);

  const leftPercent = percent(from);
  const rightPercent = percent(to);

  const handleThumbDown = (index: 0 | 1) =>
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setActiveThumb(index);
    };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const v = getValueFromClientX(e.clientX);
    // chọn thumb gần nhất để nhảy tới
    const distToFrom = Math.abs(v - from);
    const distToTo = Math.abs(v - to);
    if (distToFrom < distToTo) {
      onChange([Math.min(v, to), to]);
    } else {
      onChange([from, Math.max(v, from)]);
    }
  };

  return (
    <div className={clsx('relative h-8', className)}>
      {/* Track */}
      <div
        ref={trackRef}
        className={clsx(
          'relative h-1.5 rounded-full bg-white/10',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
        onClick={handleTrackClick}
      >
        {/* Range đã chọn */}
        <div
          className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-emerald-400 to-secondary"
          style={{
            left: `${leftPercent}%`,
            right: `${100 - rightPercent}%`,
          }}
        />

        {/* Thumb trái */}
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-slate-900 shadow-[0_0_0_2px_rgba(52,211,153,0.4)] bg-emerald-400 cursor-pointer"
          style={{ left: `${leftPercent}%` }}
          onMouseDown={handleThumbDown(0)}
          onTouchStart={handleThumbDown(0)}
        />

        {/* Thumb phải */}
        <button
          type="button"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full border-2 border-slate-900 shadow-[0_0_0_2px_rgba(52,211,153,0.4)] bg-emerald-400 cursor-pointer"
          style={{ left: `${rightPercent}%` }}
          onMouseDown={handleThumbDown(1)}
          onTouchStart={handleThumbDown(1)}
        />
      </div>
    </div>
  );
};
