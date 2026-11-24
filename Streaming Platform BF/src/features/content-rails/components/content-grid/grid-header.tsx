import { View } from "react-native";

import { BackButton, Text } from "@/components";
import {
  GRID_BACK_ICON_SIZE,
  GRID_BACK_LABEL_GAP,
  GRID_BACK_LABEL_LINE_HEIGHT,
  GRID_TITLE_BLOCK_MIN_HEIGHT,
  GRID_TITLE_LINES,
  type GridHeaderMetrics,
} from "@/features/content-rails/components/content-grid/grid-metrics";

/** Grid and skeleton header. */
export function GridHeader({
  focusBackOnMount = false,
  gridPadding,
  metrics,
  onClose,
  showTitleBlock = true,
  title,
}: {
  focusBackOnMount?: boolean;
  gridPadding: number;
  metrics: GridHeaderMetrics;
  onClose?: (() => void) | undefined;
  showTitleBlock?: boolean;
  title?: string | undefined;
}) {
  return (
    <View style={{ paddingHorizontal: gridPadding }}>
      {onClose ? (
        <BackButton
          focusOnMount={focusBackOnMount}
          iconHeight={GRID_BACK_ICON_SIZE}
          iconWidth={GRID_BACK_ICON_SIZE}
          onPress={onClose}
          style={{
            gap: GRID_BACK_LABEL_GAP,
            marginTop: metrics.backMarginTop,
          }}
          testID="content-grid-back"
          textClassName="text-white"
          textStyle={{
            fontSize: metrics.backLabelSize,
            lineHeight: GRID_BACK_LABEL_LINE_HEIGHT,
          }}
        />
      ) : null}
      {showTitleBlock ? (
        <View
          style={{
            marginTop: metrics.titleBlockMarginTop,
            minHeight: GRID_TITLE_BLOCK_MIN_HEIGHT,
            paddingTop: metrics.titlePaddingTop,
          }}
          testID="content-grid-title-block"
        >
          {title ? (
            <Text
              accessibilityRole="header"
              className="text-center text-oatmeal"
              numberOfLines={GRID_TITLE_LINES}
              style={{
                fontSize: metrics.titleSize,
                letterSpacing: metrics.titleLetterSpacing,
                lineHeight: metrics.titleSize,
              }}
              testID="content-grid-title"
              weight="semibold"
            >
              {title}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
