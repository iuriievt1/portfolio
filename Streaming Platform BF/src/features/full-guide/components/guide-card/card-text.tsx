import type { ReactNode } from "react";
import { Animated, View } from "react-native";
import type { TextBox } from "@/features/full-guide/components/guide-card/card-geometry";
import { clamped } from "@/features/full-guide/utils/guide-layout";
import {
  type GuideMetrics,
  getColumnWidth,
} from "@/features/full-guide/utils/guide-metrics";

/** How many title glyphs must fit beside the column for a card under it to show text; fewer leave a lone ellipsis. */
const MIN_SHOWN_GLYPHS = 2;

type CardTextProps = {
  box: TextBox;
  children: ReactNode;
  /** How much of the card sits under the column, for text drawn still. */
  hiddenWidth: number;
  left: number;
  metrics: GuideMetrics;
  /** The timeline's native offset for text that follows the scroll; null draws it still. */
  scrollOffset: Animated.Value | null;
  testID: string;
};

/**
 * Holds a card's text against the column while the card slides under it. The text is only as wide as what shows
 * beside the column at rest, so a title ends in an ellipsis exactly when it does not fit there.
 */
export function CardText({
  box,
  children,
  hiddenWidth,
  left,
  metrics,
  scrollOffset,
  testID,
}: CardTextProps) {
  const hiddenAt = left - getColumnWidth(metrics);
  const restingShift = Math.min(hiddenWidth, box.width);
  const shownWidth = box.width - restingShift;
  const isSliver =
    restingShift > 0 && shownWidth < metrics.titleSize * MIN_SHOWN_GLYPHS;
  const text = isSliver ? null : children;

  return (
    <View
      className="absolute inset-y-0 justify-center overflow-hidden"
      style={{ left: box.left, width: box.width }}
      testID={`${testID}-box`}
    >
      {scrollOffset ? (
        <Animated.View
          style={{
            gap: metrics.textGap,
            transform: [
              {
                translateX: scrollOffset.interpolate(
                  clamped({
                    inputRange: [hiddenAt, hiddenAt + box.width],
                    outputRange: [0, box.width],
                  }),
                ),
              },
            ],
            width: shownWidth,
          }}
          testID={testID}
        >
          {text}
        </Animated.View>
      ) : (
        <View
          style={{
            gap: metrics.textGap,
            transform: [{ translateX: restingShift }],
            width: shownWidth,
          }}
          testID={testID}
        >
          {text}
        </View>
      )}
    </View>
  );
}
