import { theme } from "@/theme/theme";
import { withAlpha } from "@/utils/colour";

export const DARK_SLATE_BLUE = theme.colors["dark-slate-blue"];

export const DARK_TO_TRANSPARENT_GRADIENT = [
  DARK_SLATE_BLUE,
  withAlpha(DARK_SLATE_BLUE, 0),
] as const;

export const TRANSPARENT_TO_DARK_GRADIENT = [
  withAlpha(DARK_SLATE_BLUE, 0),
  DARK_SLATE_BLUE,
] as const;
