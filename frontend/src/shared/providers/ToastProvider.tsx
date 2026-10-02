import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { MessagePopup } from '../components/ui/MessagePopup';
import {
  createDialogQueue,
  type MessagePayload,
  type ConfirmPayload,
} from './dialogQueue';

type ToastContextValue = {
  showMessage: (payload: MessagePayload) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  confirm: (payload: ConfirmPayload | string) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [queue] = useState(createDialogQueue);
  const current = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  useEffect(() => () => queue.clear(), [queue]);
  const value = useMemo(
    () => ({
      showMessage: queue.showMessage,
      showError: (message: string) =>
        queue.showMessage({ type: 'error', message }),
      showSuccess: (message: string) =>
        queue.showMessage({ type: 'success', message }),
      confirm: queue.confirm,
    }),
    [queue],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <MessagePopup
          key={current.id}
          open
          type={current.type}
          title={current.title}
          message={current.message}
          confirmText={current.confirmText}
          cancelText={current.cancelText}
          danger={current.danger}
          onConfirm={
            current.kind === 'confirm'
              ? () => queue.settle(current.id, true)
              : undefined
          }
          onClose={() => queue.settle(current.id, false)}
        />
      )}
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
