import { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
};

export const Button = ({
  variant = 'primary',
  loading,
  children,
  className,
  ...rest
}: PropsWithChildren<ButtonProps>) => (
  <button
    className={clsx(
      'rounded-lg px-4 py-2 font-semibold transition-all',
      {
        'bg-primary text-white hover:bg-blue-600 shadow-card': variant === 'primary',
        'bg-surface text-white border border-white/10 hover:border-white/30':
          variant === 'secondary',
        'text-white hover:text-secondary': variant === 'ghost',
      },
      loading && 'opacity-70 cursor-not-allowed',
      className,
    )}
    disabled={loading}
    {...rest}
  >
    {loading ? 'Loading...' : children}
  </button>
);
