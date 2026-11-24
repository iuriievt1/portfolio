import { Animated } from "react-native";
import { GRID_LIST_MARGIN_TOP } from "@/features/content-rails/components/content-grid/grid-metrics";
import { GridShell } from "@/features/content-rails/components/content-grid/grid-shell";
import { useGridGeometry } from "@/features/content-rails/components/content-grid/use-content-grid";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

/** One row past the fold. */
const SKELETON_OVERSCAN_ROWS = 1;

interface ContentGridSkeletonProps {
  onClose?: (() => void) | undefined;
}

/** Grid placeholder. */
export function ContentGridSkeleton({ onClose }: ContentGridSkeletonProps) {
  const {
    columnGap,
    columns,
    estimatedViewportHeight,
    gridPadding,
    header,
    paddingTop,
    rowGap,
    rowStride,
    tileWidth,
  } = useGridGeometry();
  const opacity = usePulseOpacity();

  const rowCount = Math.max(
    1,
    Math.ceil(estimatedViewportHeight / rowStride) + SKELETON_OVERSCAN_ROWS,
  );
  const tileKeys = Array.from(
    { length: rowCount * columns },
    (_, index) => `grid-skeleton-${index}`,
  );

  return (
    <GridShell
      gridPadding={gridPadding}
      metrics={header}
      onClose={onClose}
      paddingTop={paddingTop}
    >
      <Animated.View
        accessibilityLabel="Loading titles"
        accessibilityRole="progressbar"
        className="flex-row flex-wrap"
        style={{
          columnGap,
          marginTop: GRID_LIST_MARGIN_TOP,
          opacity,
          paddingHorizontal: gridPadding,
          rowGap,
        }}
        testID="content-grid-skeleton"
      >
        {tileKeys.map((key) => (
          <ContentTileSkeleton key={key} width={tileWidth} />
        ))}
      </Animated.View>
    </GridShell>
  );
}
