import type { PropsWithChildren } from 'react';
import clsx from 'clsx';
import { Button } from './Button';

type MessagePopupProps = PropsWithChildren<{
  open: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  title?: string;
  onClose?: () => void;
}>;

export const MessagePopup = ({
  open,
  message,
  type = 'info',
  title,
  onClose,
  children,
}: MessagePopupProps) => {
  if (!open) return null;

  const tone = {
    success: 'border-emerald-300 bg-emerald-500/10 text-emerald-50',
    error: 'border-rose-300 bg-rose-500/10 text-rose-50',
    info: 'border-white/20 bg-white/10 text-white',
  }[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="alertdialog"
        aria-live="assertive"
        aria-label={title || 'Message'}
        className={clsx(
          'relative w-full max-w-md rounded-2xl border shadow-xl shadow-black/40 p-5',
          'bg-surface',
          tone,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <div className="text-lg font-semibold">{title || 'Thong bao'}</div>
            <div className="text-sm leading-relaxed">{message}</div>
            {children ? <div className="pt-2">{children}</div> : null}
          </div>
          {onClose ? (
            <Button variant="ghost" onClick={onClose} aria-label="Close message" className="px-2 py-1">
              ✕
            </Button>
          ) : null}
        </div>
        {!onClose ? null : (
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Dong</Button>
          </div>
        )}
      </div>
    </div>
  );
};
