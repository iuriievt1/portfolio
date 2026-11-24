import { Animated, View } from "react-native";
import { ContentTileSkeleton } from "@/features/content-rails/components/content-tile-skeleton/content-tile-skeleton";
import { RailTitle } from "@/features/content-rails/components/rail-title/rail-title";
import type { TileSize } from "@/features/content-rails/types";
import type { TileVariant } from "@/features/content-rails/utils/tile-metrics";
import {
  getTileAspectRatio,
  getTileFormFactor,
  getTileWidth,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

const SKELETON_TILE_COUNT = 5;
const SKELETON_TILE_KEYS = Array.from(
  { length: SKELETON_TILE_COUNT },
  (_, index) => `skeleton-tile-${index}`,
);
interface ContentRailSkeletonProps {
  isTablet: boolean;
  isLandscape?: boolean;
  reservesLabelBlock?: boolean;
  size: TileSize;
  title: string;
  className?: string;
  variant?: TileVariant;
}

/** Holds the rail's final height while loading, so content below never jumps. */
export function ContentRailSkeleton({
  isTablet,
  isLandscape = false,
  reservesLabelBlock = true,
  size,
  title,
  className = "",
  variant = TILE_VARIANT.LANDSCAPE,
}: ContentRailSkeletonProps) {
  const width = getTileWidth({ isLandscape, isTablet, size, variant });
  const aspectRatio = getTileAspectRatio(variant, {
    formFactor: getTileFormFactor({ isLandscape, isTablet }),
    size,
  });
  const opacity = usePulseOpacity();

  return (
    <View className={className} testID="content-rail-skeleton">
      <RailTitle isLandscape={isLandscape} isTablet={isTablet}>
        {title}
      </RailTitle>
      <Animated.View style={{ opacity }}>
        <View
          className={
            isTablet ? "flex-row gap-4 px-10" : "flex-row gap-2 px-3 pt-2"
          }
        >
          {SKELETON_TILE_KEYS.map((key) => (
            <ContentTileSkeleton
              aspectRatio={aspectRatio}
              key={key}
              reservesLabelBlock={reservesLabelBlock}
              variant={variant}
              width={width}
            />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}
