import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useRef,
} from "react";
import {
  Animated,
  PanResponder,
  type PanResponderGestureState,
  View,
} from "react-native";

// How far a finger must move sideways before it counts as a swipe, not a scroll.
const SWIPE_START_DISTANCE = 10;
// The actions fade in over the first part of the swipe.
const FADE_DISTANCE = 20;

// How to close the row that is open, or null when no row is open.
const SwipeRowAreaContext = createContext<RefObject<
  (() => void) | null
> | null>(null);

// A touch anywhere inside this closes the open row.
export function SwipeRowArea({ children }: { children: ReactNode }) {
  const closeOpenRowRef = useRef<(() => void) | null>(null);

  return (
    <SwipeRowAreaContext value={closeOpenRowRef}>
      <View className="flex-1" onTouchStart={() => closeOpenRowRef.current?.()}>
        {children}
      </View>
    </SwipeRowAreaContext>
  );
}

type SwipeRowProps = {
  // Nothing to show means nothing to swipe open.
  actions: ReactNode;
  children: ReactNode;
};

// Swipe left to shrink the row from the right and show its actions. Swipe right to close.
export function SwipeRow({ actions, children }: SwipeRowProps) {
  // How much the row has shrunk, in px: 0 when closed, the actions' width when open.
  const shrink = useRef(new Animated.Value(0)).current;
  const actionsWidth = useRef(0);
  const isOpen = useRef(false);
  const closeOpenRowRef = useContext(SwipeRowAreaContext);

  // Animate to fully open or fully closed.
  const snapTo = (open: boolean) => {
    isOpen.current = open;
    // Tell the area how to close this row while it is open.
    if (closeOpenRowRef) {
      closeOpenRowRef.current = open ? () => snapTo(false) : null;
    }
    Animated.timing(shrink, {
      duration: 200,
      toValue: open ? actionsWidth.current : 0,
      useNativeDriver: false,
    }).start();
  };

  // The shrink for a finger that has moved dx from where the swipe started.
  const shrinkFor = (dx: number) => {
    const start = isOpen.current ? actionsWidth.current : 0;

    return Math.min(Math.max(start - dx, 0), actionsWidth.current);
  };

  // A sideways drag, not a page scroll.
  const isSideways = (gesture: PanResponderGestureState) =>
    Math.abs(gesture.dx) > SWIPE_START_DISTANCE &&
    Math.abs(gesture.dx) > Math.abs(gesture.dy);

  const swipe = useRef(
    PanResponder.create({
      // Only take the touch for a sideways drag, so the page still scrolls.
      onMoveShouldSetPanResponder: (_event, gesture) => isSideways(gesture),
      // Follow the finger.
      onPanResponderMove: (_event, gesture) =>
        shrink.setValue(shrinkFor(gesture.dx)),
      // On release, open if more than half is showing, otherwise close.
      onPanResponderRelease: (_event, gesture) =>
        snapTo(shrinkFor(gesture.dx) > actionsWidth.current / 2),
      // Once a swipe starts, don't let the page take it over.
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  if (!actions) {
    return children;
  }

  // The actions sit behind the row, on the right. The row's right margin grows
  // as it shrinks, so its left edge stays put and the actions show in the space.
  // Screen readers skip the actions: they can't swipe, so the row offers the same as accessibility actions.
  return (
    <View>
      <Animated.View
        accessibilityElementsHidden
        className="absolute bottom-0 right-0 top-0 justify-center pl-2"
        importantForAccessibility="no-hide-descendants"
        onLayout={(event) => {
          actionsWidth.current = event.nativeEvent.layout.width;
        }}
        style={{
          opacity: shrink.interpolate({
            extrapolate: "clamp",
            inputRange: [0, FADE_DISTANCE],
            outputRange: [0, 1],
          }),
        }}
      >
        {actions}
      </Animated.View>
      <Animated.View style={{ marginRight: shrink }} {...swipe.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
