import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { theme } from "@/theme/theme";
import { withAlpha } from "@/utils/colour";

const SCRIM_COLOUR = theme.colors["dark-slate-blue"];

export const TOP_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0.65),
  withAlpha(SCRIM_COLOUR, 0),
] as const;
export const BOTTOM_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0),
  withAlpha(SCRIM_COLOUR, 0.65),
] as const;
export const VOD_TOP_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0.7),
  withAlpha(SCRIM_COLOUR, 0),
] as const;
export const VOD_BOTTOM_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0),
  withAlpha(SCRIM_COLOUR, 0.5),
] as const;
export const GENRE_TOP_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0.5),
  withAlpha(SCRIM_COLOUR, 0),
] as const;
export const GENRE_BOTTOM_SCRIM_COLOURS = [
  withAlpha(SCRIM_COLOUR, 0),
  withAlpha(SCRIM_COLOUR, 0.7),
] as const;

/** Darkens one edge of the artwork so an overlay stays legible over it. */
export function TileScrim({
  colours,
  edge,
}: {
  colours: readonly [string, string];
  edge: "bottom" | "top";
}) {
  return (
    <View
      className={`absolute inset-x-0 h-1/2 ${edge === "top" ? "top-0" : "bottom-0"}`}
      pointerEvents="none"
      testID="content-tile-scrim"
    >
      <LinearGradient colors={colours} style={StyleSheet.absoluteFill} />
    </View>
  );
}
