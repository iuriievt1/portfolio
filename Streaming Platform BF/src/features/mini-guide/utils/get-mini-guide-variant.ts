import type { MiniGuideVariant } from "../types";

export function getMiniGuideVariant({
  isLandscape,
  isTablet,
}: {
  isLandscape: boolean;
  isTablet: boolean;
}): MiniGuideVariant {
  if (!isTablet) {
    return "mobile";
  }

  return isLandscape ? "tablet-landscape" : "tablet-portrait";
}
