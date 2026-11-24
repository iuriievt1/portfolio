import { useState } from "react";
import { Animated, PanResponder } from "react-native";

const SWIPE_START_DISTANCE = 10;
const SWIPE_DISTANCE_RATIO = 0.2;
const SWIPE_SPEED = 0.3;
const SETTLE_DURATION_MS = 250;

/** 1 moves to the next card, -1 to the previous one, 0 stays. */
export function getSwipeStep(dx: number, vx: number, itemSize: number) {
  if (dx < -itemSize * SWIPE_DISTANCE_RATIO || vx < -SWIPE_SPEED) {
    return 1;
  }

  if (dx > itemSize * SWIPE_DISTANCE_RATIO || vx > SWIPE_SPEED) {
    return -1;
  }

  return 0;
}

/** The Hero carousel's swipe: the current card, how far the cards have moved, and the touch handlers. */
export function useHeroSwipe({
  isLooping,
  itemSize,
}: {
  isLooping: boolean;
  itemSize: number;
}) {
  // Keeps counting past the ends; getItemIndex turns it into an item.
  const [activeCard, setActiveCard] = useState(0);
  // How far the cards have moved, in cards. It is -activeCard at rest.
  // State, not a ref: the compiler forbids reading a ref during render.
  const [position] = useState(() => new Animated.Value(0));
  const [isSettling, setIsSettling] = useState(false);

  // Slides by step cards: 1 next, -1 previous, 0 back to the current card.
  const settle = (step: number) => {
    const nextCard = activeCard + step;

    setIsSettling(true);
    Animated.timing(position, {
      duration: SETTLE_DURATION_MS,
      toValue: -nextCard,
      useNativeDriver: false,
    }).start(() => {
      setIsSettling(false);
      setActiveCard(nextCard);
    });
  };

  // React Compiler keeps this between renders, so a re-render mid-swipe keeps the same gesture.
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      isLooping &&
      !isSettling &&
      Math.abs(dx) > SWIPE_START_DISTANCE &&
      Math.abs(dx) > Math.abs(dy),
    onPanResponderMove: (_, { dx }) => {
      position.setValue(-activeCard + dx / itemSize);
    },
    onPanResponderRelease: (_, { dx, vx }) => {
      settle(getSwipeStep(dx, vx, itemSize));
    },
    onPanResponderTerminate: () => {
      settle(0);
    },
    onPanResponderTerminationRequest: () => false,
  });

  return {
    activeCard,
    isSettling,
    panHandlers: panResponder.panHandlers,
    position,
    settle,
  };
}
