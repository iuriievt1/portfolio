import { useRef } from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

const SCROLL_GRADIENT_FADE_DISTANCE = 120;

export function useScrollAwayGradient() {
  const opacity = useRef(new Animated.Value(0)).current;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    opacity.setValue(
      Math.min(Math.max(offsetY / SCROLL_GRADIENT_FADE_DISTANCE, 0), 1),
    );
  };

  return { onScroll, opacity };
}
