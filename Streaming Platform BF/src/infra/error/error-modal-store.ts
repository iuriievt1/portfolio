import { createStore, useStore } from "zustand";

type ErrorModalState = {
  code: string | null;
  onRetry: (() => void) | null;
};

/** One dialog at a time. */
export const errorModalStore = createStore<ErrorModalState>(() => ({
  code: null,
  onRetry: null,
}));

/** The retry runs the latest call the dialog was raised for. */
export function showErrorModal(code: string, onRetry?: () => void) {
  if (errorModalStore.getState().code === code) {
    if (onRetry) {
      errorModalStore.setState({ onRetry });
    }

    return;
  }

  errorModalStore.setState({ code, onRetry: onRetry ?? null });
}

export function dismissErrorModal() {
  errorModalStore.setState({ code: null, onRetry: null });
}

export function useErrorModalState() {
  return useStore(errorModalStore);
}
