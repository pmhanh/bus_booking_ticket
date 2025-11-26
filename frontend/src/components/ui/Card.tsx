import { PropsWithChildren, ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = PropsWithChildren<{ title?: string; actions?: ReactNode; className?: string }>;

export const Card = ({ title, actions, children, className }: CardProps) => (
  <div className={clsx('glass rounded-2xl p-6 shadow-card border border-white/5', className)}>
    {title ? (
      <div className="flex items-center justify-center mb-4">
        <h3 className="text-lg font-semibold text-white text-center flex-1">{title}</h3>
        {actions}
      </div>
    ) : null}
    {children}
  </div>
);
