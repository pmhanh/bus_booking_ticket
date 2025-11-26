import { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = {
  label: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const FormField = ({ label, error, className, ...rest }: Props) => (
  <label className="block text-sm text-gray-200 mb-3">
    <div className="mb-2 font-medium">{label}</div>
    <input
      className={clsx(
        'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-secondary',
        className,
      )}
      {...rest}
    />
    {error ? <p className="text-xs text-error mt-1">{error}</p> : null}
  </label>
);
