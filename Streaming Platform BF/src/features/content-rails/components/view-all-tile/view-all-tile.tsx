import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components";
import type { TileVariant } from "@/features/content-rails/utils/tile-metrics";
import {
  getTileAspectRatio,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";
import { theme } from "@/theme/theme";

const VIEW_ALL_LABEL = "View All";

const VIEW_ALL_GRADIENT_COLORS = [
  theme.colors["medium-slate-blue"],
  theme.colors["slate-blue"],
  theme.colors["medium-slate-blue"],
] as const;
const VIEW_ALL_GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

interface ViewAllTileProps {
  aspectRatio?: number;
  width: number;
  onPress?: (() => void) | undefined;
  variant?: TileVariant;
}

export function ViewAllTile({
  aspectRatio,
  width,
  onPress,
  variant = TILE_VARIANT.LANDSCAPE,
}: ViewAllTileProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={VIEW_ALL_LABEL}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={{ width }}
    >
      {({ pressed }) => (
        <View
          className={[
            "items-center justify-center overflow-hidden rounded border-2",
            pressed || isFocused
              ? "border-golden-yellow"
              : "border-transparent",
          ].join(" ")}
          style={{ aspectRatio: aspectRatio ?? getTileAspectRatio(variant) }}
        >
          <LinearGradient
            colors={VIEW_ALL_GRADIENT_COLORS}
            end={{ x: 1, y: 1 }}
            locations={VIEW_ALL_GRADIENT_LOCATIONS}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text
            className="text-[20px] leading-[20px] tracking-[0.2px] text-white"
            weight="bold"
          >
            {VIEW_ALL_LABEL}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
