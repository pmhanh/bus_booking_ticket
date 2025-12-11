import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const FormField = ({ label, error, className, ...rest }: Props) => {
  const hasError = Boolean(error);

  return (
    <label className={clsx('block text-sm mb-3', hasError ? 'text-error' : 'text-gray-200')}>
      <div className="mb-2 font-medium">{label}</div>
      <input
        className={clsx(
          'w-full rounded-lg bg-white/5 px-3 py-2 text-white focus:outline-none focus:ring-2',
          hasError
            ? 'border border-error text-error placeholder:text-error/80 focus:ring-error'
            : 'border border-white/10 focus:ring-secondary',
          className,
        )}
        {...rest}
      />
      {hasError ? (
        <p className="text-xs text-error mt-1 flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </label>
  );
};
