import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import RankGlow from "@/assets/icons/tile-rank-glow.svg";
import type { TileSize } from "@/features/content-rails/types";
import {
  getTileFormFactor,
  TILE_RANK_BADGE,
  TILE_RANK_STROKE_WIDTH,
} from "@/features/content-rails/utils/tile-metrics";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";

const RANK_GRADIENT_ID = "tile-rank-fill";

/** Corner glow with rank, sized by device and tile size. */
export function TileRank({ rank, size }: { rank: number; size: TileSize }) {
  const { isLandscape, isTablet } = useDeviceLayout();
  const badge =
    TILE_RANK_BADGE[getTileFormFactor({ isLandscape, isTablet })][size];

  return (
    <View
      className="absolute bottom-0 right-0"
      pointerEvents="none"
      testID="content-tile-rank"
    >
      <RankGlow
        height={badge.height}
        preserveAspectRatio="none"
        width={badge.width}
      />
      <Svg
        height={badge.height}
        style={StyleSheet.absoluteFill}
        width={badge.width}
      >
        <Defs>
          <LinearGradient id={RANK_GRADIENT_ID} x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={theme.colors["cyan-60"]} />
            <Stop offset="0.5" stopColor={theme.colors.cyan} />
            <Stop offset="1" stopColor={theme.colors["cyan-60"]} />
          </LinearGradient>
        </Defs>
        <SvgText
          fill={`url(#${RANK_GRADIENT_ID})`}
          fontFamily={theme.fontFamily["euclid-bold"]}
          fontSize={badge.fontSize}
          stroke={theme.colors["cyan-40"]}
          strokeWidth={TILE_RANK_STROKE_WIDTH}
          textAnchor="middle"
          x={badge.numberX}
          y={badge.numberY}
        >
          {String(rank)}
        </SvgText>
      </Svg>
    </View>
  );
}
