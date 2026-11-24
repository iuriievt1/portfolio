import { useCallback, useEffect, useRef } from "react";

const MINI_GUIDE_INACTIVITY_MS = 5000;

export function useMiniGuideAutoDismiss(onDismiss: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(onDismiss, MINI_GUIDE_INACTIVITY_MS);
  }, [onDismiss]);

  useEffect(() => {
    scheduleDismiss();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [scheduleDismiss]);

  return scheduleDismiss;
}
