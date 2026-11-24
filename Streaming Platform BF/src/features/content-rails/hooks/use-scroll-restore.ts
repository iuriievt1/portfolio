import { useCallback, useRef } from "react";
import { Animated, Easing } from "react-native";

const SCROLL_RESTORE_FRAMES = 45;
const SCROLL_COVER_HOLD_MS = 320;
const SCROLL_COVER_FADE_MS = 180;

/** Scroll restore behind a cover. */
export function useScrollRestore() {
  const isRestoringRef = useRef(false);
  const coverOpacity = useRef(new Animated.Value(0)).current;

  const cancel = useCallback(() => {
    isRestoringRef.current = false;
    coverOpacity.stopAnimation();
    coverOpacity.setValue(0);
  }, [coverOpacity]);

  /** Starts it, returns the cleanup. */
  const start = useCallback(
    (scrollToOffset: () => void) => {
      isRestoringRef.current = true;
      coverOpacity.setValue(1);

      let frame = 0;
      let rafId = requestAnimationFrame(function restore() {
        if (!isRestoringRef.current) {
          return;
        }

        scrollToOffset();
        frame += 1;

        if (frame < SCROLL_RESTORE_FRAMES) {
          rafId = requestAnimationFrame(restore);
          return;
        }

        isRestoringRef.current = false;
      });

      const fadeTimeout = setTimeout(() => {
        Animated.timing(coverOpacity, {
          duration: SCROLL_COVER_FADE_MS,
          easing: Easing.out(Easing.ease),
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }, SCROLL_COVER_HOLD_MS);

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(fadeTimeout);
        cancel();
      };
    },
    [cancel, coverOpacity],
  );

  const isRestoring = useCallback(() => isRestoringRef.current, []);

  return { cancel, coverOpacity, isRestoring, start };
}
