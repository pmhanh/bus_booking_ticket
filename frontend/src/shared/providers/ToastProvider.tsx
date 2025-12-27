import { createContext, useContext, useState, type PropsWithChildren, useCallback } from 'react';
import { MessagePopup } from '../components/ui/MessagePopup';

type ToastPayload = {
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
};

type ToastContextValue = {
  showMessage: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toast, setToast] = useState<ToastPayload & { open: boolean }>({
    open: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showMessage = useCallback((payload: ToastPayload) => {
    setToast({ open: true, type: payload.type || 'info', title: payload.title, message: payload.message });
  }, []);

  const handleClose = () => setToast((prev) => ({ ...prev, open: false }));

  return (
    <ToastContext.Provider value={{ showMessage }}>
      {children}
      <MessagePopup
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={handleClose}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};