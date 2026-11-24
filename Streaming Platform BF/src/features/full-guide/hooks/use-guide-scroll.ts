import { useRef, useState } from "react";
import { Animated, type ScrollView } from "react-native";

export type GuideScroll = ReturnType<typeof useGuideScroll>;

/** The timeline's offset: a native animated value for what pins to it, and a ref for handlers. */
export function useGuideScroll() {
  const scrollRef = useRef<ScrollView | null>(null);
  // State, not a ref: the compiler forbids reading a ref during render.
  const [scrollOffset] = useState(() => new Animated.Value(0));
  const offsetRef = useRef(0);

  const readOffset = () => offsetRef.current;

  const follow = (offsetX: number) => {
    offsetRef.current = offsetX;
  };

  // Native scroll events never reach the value's JS side on Android, and every React commit of a view pinned
  // to it would draw it at that stale offset. Once the timeline rests, hand the resting offset to both sides.
  const settle = (offsetX: number) => {
    offsetRef.current = offsetX;
    scrollOffset.setValue(offsetX);
  };

  const scrollTo = (offsetX: number, { animated = false } = {}) => {
    scrollRef.current?.scrollTo({ animated, x: offsetX });

    if (animated) {
      offsetRef.current = offsetX;
    } else {
      settle(offsetX);
    }
  };

  return {
    follow,
    readOffset,
    scrollOffset,
    scrollRef,
    scrollTo,
    settle,
  };
}
