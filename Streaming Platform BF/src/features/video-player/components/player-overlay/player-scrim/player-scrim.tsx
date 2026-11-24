import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { theme } from "@/theme/theme";
import { withAlpha } from "@/utils/colour";

const SCRIM_COLOR = theme.colors["dark-slate-blue"];

const SCRIM_COLORS = [
  withAlpha(SCRIM_COLOR, 0.6),
  withAlpha(SCRIM_COLOR, 0),
  withAlpha(SCRIM_COLOR, 0),
  withAlpha(SCRIM_COLOR, 0.8),
] as const;
const SCRIM_LOCATIONS = [0, 0.3, 0.4, 1] as const;

type PlayerScrimProps = {
  horizontalInset?: number;
  verticalInset?: number;
};

export function PlayerScrim({
  horizontalInset = 0,
  verticalInset = 0,
}: PlayerScrimProps) {
  return (
    <View
      className="absolute"
      pointerEvents="none"
      style={{
        bottom: verticalInset,
        left: horizontalInset,
        right: horizontalInset,
        top: verticalInset,
      }}
      testID="player-scrim"
    >
      <LinearGradient
        colors={SCRIM_COLORS}
        end={{ x: 0, y: 1 }}
        locations={SCRIM_LOCATIONS}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
