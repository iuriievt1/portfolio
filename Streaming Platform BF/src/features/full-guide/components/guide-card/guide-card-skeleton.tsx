import { StyleSheet, View } from "react-native";
import { getTextBox } from "@/features/full-guide/components/guide-card/card-geometry";
import {
  CARD_BORDER,
  CARD_RADIUS,
  type GuideMetrics,
} from "@/features/full-guide/utils/guide-metrics";
import { colors } from "@/theme/colors";

const TITLE_SHARE = 0.6;
const TIME_SHARE = 0.35;
const BAR_SCALE = 0.75;

type GuideCardSkeletonProps = {
  left: number;
  metrics: GuideMetrics;
  testID: string;
  width: number;
};

/** A programme card's place while its card is still to be drawn: its shape, with bars for the text. */
export function GuideCardSkeleton({
  left,
  metrics,
  testID,
  width,
}: GuideCardSkeletonProps) {
  const box = getTextBox(width, metrics);

  return (
    <View
      style={[styles.card, { height: metrics.cellHeight, left, width }]}
      testID={testID}
    >
      {box.width > 0 ? (
        <View
          style={[
            styles.text,
            { gap: metrics.textGap, left: box.left, width: box.width },
          ]}
        >
          <View
            style={[
              styles.bar,
              {
                height: metrics.titleSize * BAR_SCALE,
                width: `${TITLE_SHARE * 100}%`,
              },
            ]}
          />
          <View
            style={[
              styles.bar,
              {
                height: metrics.subtitleSize * BAR_SCALE,
                width: `${TIME_SHARE * 100}%`,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

// Plain styles: skeletons stand in for cards precisely when the JS thread is busiest.
const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors["transparent-white-10"],
    borderRadius: CARD_BORDER,
  },
  card: {
    backgroundColor: colors["medium-slate-blue"],
    borderColor: colors["transparent-white-10"],
    borderRadius: CARD_RADIUS,
    borderWidth: CARD_BORDER,
    position: "absolute",
    top: 0,
  },
  text: {
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    top: 0,
  },
});
