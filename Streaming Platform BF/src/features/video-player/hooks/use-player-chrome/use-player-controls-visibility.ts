import { useCallback, useEffect, useRef, useState } from "react";

const CONTROLS_FADE_DELAY_MS = 3000;

export function usePlayerControlsVisibility(active: boolean) {
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFadeTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideControls = useCallback(() => {
    clearFadeTimer();
    setAreControlsVisible(false);
  }, [clearFadeTimer]);

  const scheduleFade = useCallback(() => {
    clearFadeTimer();

    if (!active) {
      return;
    }

    timerRef.current = setTimeout(() => {
      setAreControlsVisible(false);
      timerRef.current = null;
    }, CONTROLS_FADE_DELAY_MS);
  }, [active, clearFadeTimer]);

  const showControls = useCallback(() => {
    setAreControlsVisible(true);
    scheduleFade();
  }, [scheduleFade]);

  const markInteraction = useCallback(() => {
    showControls();
  }, [showControls]);

  const toggleControlsFromBodyPress = useCallback(() => {
    if (areControlsVisible) {
      hideControls();
      return;
    }

    showControls();
  }, [areControlsVisible, hideControls, showControls]);

  useEffect(() => {
    if (!active) {
      clearFadeTimer();
      setAreControlsVisible(true);
      return;
    }

    setAreControlsVisible(true);
    scheduleFade();

    return clearFadeTimer;
  }, [active, clearFadeTimer, scheduleFade]);

  return {
    areControlsVisible,
    markInteraction,
    toggleControlsFromBodyPress,
  };
}
