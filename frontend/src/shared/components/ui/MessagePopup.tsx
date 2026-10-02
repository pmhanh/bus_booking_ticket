import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Button } from './Button';

type MessagePopupProps = {
  open: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

export const MessagePopup = ({
  open,
  message,
  type = 'info',
  title,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  danger = false,
  onConfirm,
  onClose,
}: MessagePopupProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [open]);

  const isConfirmation = Boolean(onConfirm);
  const heading =
    title ||
    (isConfirmation
      ? 'Xác nhận thao tác'
      : {
          success: 'Thành công',
          error: 'Đã xảy ra lỗi',
          info: 'Thông báo',
        }[type]);
  const tone = isConfirmation ? 'warning' : type;
  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-white/15 bg-slate-900 p-0 text-white shadow-2xl backdrop:bg-black/65 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            aria-hidden="true"
            className={clsx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl font-bold',
              {
                'bg-emerald-500/15 text-emerald-300': tone === 'success',
                'bg-rose-500/15 text-rose-300': tone === 'error',
                'bg-sky-500/15 text-sky-300': tone === 'info',
                'bg-amber-500/15 text-amber-300': tone === 'warning',
              },
            )}
          >
            {tone === 'success' ? '✓' : tone === 'info' ? 'i' : '!'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {heading}
            </h2>
            <p
              id={messageId}
              className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-300"
            >
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            ✕
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {isConfirmation ? (
            <>
              <Button
                type="button"
                variant="secondary"
                autoFocus
                onClick={onClose}
              >
                {cancelText}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                className={
                  danger ? '!bg-rose-600 hover:!bg-rose-500' : undefined
                }
              >
                {confirmText}
              </Button>
            </>
          ) : (
            <Button type="button" autoFocus onClick={onClose}>
              Đóng
            </Button>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
};
