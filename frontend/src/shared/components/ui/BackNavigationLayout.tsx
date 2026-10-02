import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  onBack: () => void;
  backLabel?: string;
  contentClassName?: string;
}>;

export const BackNavigationLayout = ({
  onBack,
  backLabel = 'Quay lại',
  contentClassName = 'max-w-5xl space-y-4',
  children,
}: Props) => (
  <div className="mx-auto grid max-w-7xl items-start gap-4 lg:grid-cols-[36px_minmax(0,1fr)_36px] print:block">
    <aside className="lg:sticky lg:top-28 print:hidden">
      <button
        type="button"
        aria-label={backLabel}
        title={backLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm text-emerald-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        onClick={onBack}
      >
        ←
      </button>
    </aside>
    <div className={`mx-auto w-full min-w-0 ${contentClassName}`}>
      {children}
    </div>
  </div>
);
