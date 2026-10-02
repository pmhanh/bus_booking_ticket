import { useCallback, useState } from 'react';
import { useToast } from './ToastProvider';

// Some pages need the error state to select their empty/retry view as well.
export function useErrorNotification() {
  const [error, setError] = useState<string | null>(null);
  const { showError } = useToast();
  const reportError = useCallback(
    (message: string | null) => {
      setError(message);
      if (message) showError(message);
    },
    [showError],
  );
  return [error, reportError] as const;
}
