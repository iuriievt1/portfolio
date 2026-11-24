import { theme } from "@/theme/theme";
import { withAlpha } from "@/utils/colour";

const BASE_COLOUR = theme.colors["dark-slate-blue"];
const BLACK_COLOUR = theme.colors.black;

/** Backdrop glow stops taken from the live channel page designs. */
export const PHONE_GLOW_COLOURS = ["#070c0d", "#04323e"] as const;
export const TABLET_PORTRAIT_GLOW_COLOURS = [
  BLACK_COLOUR,
  "#0a2227",
  "#07434d",
  "#046171",
  "#057285",
] as const;
export const TABLET_LANDSCAPE_GLOW_COLOURS = [
  BLACK_COLOUR,
  "#0a191e",
  "#073842",
  "#056171",
  "#047386",
] as const;

/** Fade that settles the glow into the page colour. */
export const PHONE_FADE_COLOURS = [
  withAlpha(BASE_COLOUR, 0),
  BASE_COLOUR,
] as const;
export const PHONE_FADE_LOCATIONS = [0, 0.89] as const;
export const TABLET_FADE_COLOURS = [
  withAlpha(BASE_COLOUR, 0),
  withAlpha(BASE_COLOUR, 0.345),
  withAlpha(BASE_COLOUR, 0.59),
  withAlpha(BASE_COLOUR, 0.85),
  BASE_COLOUR,
] as const;

/** Glow stops for the current form factor. */
export function getChannelDetailsGlowColours({
  isLandscape,
  isTablet,
}: {
  isLandscape: boolean;
  isTablet: boolean;
}) {
  if (!isTablet) {
    return PHONE_GLOW_COLOURS;
  }

  return isLandscape
    ? TABLET_LANDSCAPE_GLOW_COLOURS
    : TABLET_PORTRAIT_GLOW_COLOURS;
}
