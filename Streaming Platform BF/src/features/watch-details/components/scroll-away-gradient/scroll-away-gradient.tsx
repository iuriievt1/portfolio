import { LinearGradient } from "expo-linear-gradient";
import { Animated, StyleSheet } from "react-native";
import { DARK_TO_TRANSPARENT_GRADIENT } from "@/features/watch-details/utils/gradients";

export function ScrollAwayGradient({
  height,
  opacity,
}: {
  height: number;
  opacity: Animated.Value;
}) {
  return (
    <Animated.View
      className="absolute inset-x-0 top-0"
      pointerEvents="none"
      style={{ height, opacity }}
    >
      <LinearGradient
        colors={DARK_TO_TRANSPARENT_GRADIENT}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
