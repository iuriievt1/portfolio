import { type DimensionValue, View } from "react-native";

import type { TileVariant } from "@/features/content-rails/utils/tile-metrics";
import {
  getTileAspectRatio,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";

interface ContentTileSkeletonProps {
  aspectRatio?: number;
  reservesLabelBlock?: boolean;
  width: DimensionValue;
  variant?: TileVariant;
}

/** Bars sit in boxes the height of the tile's real text lines. */
export function ContentTileSkeleton({
  aspectRatio,
  reservesLabelBlock = true,
  width,
  variant = TILE_VARIANT.LANDSCAPE,
}: ContentTileSkeletonProps) {
  return (
    <View style={{ width }}>
      <View
        className={[
          "overflow-hidden bg-medium-slate-blue",
          variant === TILE_VARIANT.SQUARE_CARD ? "rounded-lg" : "rounded",
        ].join(" ")}
        style={{ aspectRatio: aspectRatio ?? getTileAspectRatio(variant) }}
      />
      {reservesLabelBlock ? (
        <View testID="content-tile-skeleton-label">
          <View className="mt-2 h-[18px] justify-center">
            <View className="h-[10px] w-3/4 rounded bg-transparent-white-10" />
          </View>
          <View className="h-[18px] justify-center">
            <View className="h-[10px] w-1/2 rounded bg-transparent-white-10" />
          </View>
        </View>
      ) : null}
    </View>
  );
}
