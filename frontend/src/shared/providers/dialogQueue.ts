export type MessagePayload = {
  type?: 'success' | 'error' | 'info';
  title?: string;
  message: string;
};

export type ConfirmPayload = {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

export type DialogEntry = MessagePayload &
  ConfirmPayload & {
    id: number;
    kind: 'message' | 'confirm';
    resolve?: (confirmed: boolean) => void;
  };

export function createDialogQueue() {
  let entries: DialogEntry[] = [];
  let nextId = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries[0] ?? null,
    showMessage(payload: MessagePayload) {
      if (!payload.message.trim()) return;
      // Concurrent requests can fail for the same reason; show that error once.
      if (
        entries.some(
          (entry) =>
            entry.kind === 'message' &&
            entry.message === payload.message &&
            entry.type === payload.type &&
            entry.title === payload.title,
        )
      )
        return;
      entries = [...entries, { ...payload, id: ++nextId, kind: 'message' }];
      emit();
    },
    confirm(payload: ConfirmPayload | string): Promise<boolean> {
      const options =
        typeof payload === 'string' ? { message: payload } : payload;
      // A double click must not queue a second execution of the same action.
      if (
        entries.some(
          (entry) =>
            entry.kind === 'confirm' &&
            entry.message === options.message &&
            entry.title === options.title,
        )
      ) {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        entries = [
          ...entries,
          {
            ...options,
            id: ++nextId,
            kind: 'confirm',
            resolve,
          },
        ];
        emit();
      });
    },
    settle(id: number, confirmed: boolean) {
      const current = entries[0];
      if (!current || current.id !== id) return;
      entries = entries.slice(1);
      current.resolve?.(confirmed);
      emit();
    },
    clear() {
      const pending = entries;
      entries = [];
      pending.forEach((entry) => entry.resolve?.(false));
      emit();
    },
  };
}
