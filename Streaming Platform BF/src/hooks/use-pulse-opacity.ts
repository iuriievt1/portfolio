import { useEffect, useRef } from "react";
import { Animated } from "react-native";

const PULSE_MIN_OPACITY = 0.4;
const PULSE_DURATION_MS = 800;

/** Fades a view in and out, for placeholders that should read as loading. */
export function usePulseOpacity() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: PULSE_DURATION_MS,
          toValue: PULSE_MIN_OPACITY,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: PULSE_DURATION_MS,
          toValue: 1,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [opacity]);

  return opacity;
}
