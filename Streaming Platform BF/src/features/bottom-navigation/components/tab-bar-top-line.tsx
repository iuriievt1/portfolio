import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/theme/theme";

const LINE_COLORS = [
  theme.colors["dark-teal"],
  theme.colors.teal,
  theme.colors["dark-teal"],
] as const;

// 2px line along the top of the tab bar: dim at the edges, bright in the middle.
export function TabBarTopLine() {
  return (
    <LinearGradient
      colors={LINE_COLORS}
      end={{ x: 1, y: 0 }}
      start={{ x: 0, y: 0 }}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
    />
  );
}
