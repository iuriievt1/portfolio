import type { ViewStyle } from "react-native";
import { HERO_ASPECT_RATIO } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";

export const TABLET_HORIZONTAL_INSET = 40;
export const RELATED_TILE_GAP = 16;
export const TABLET_SCROLL_GRADIENT_HEIGHT = 410;

/** The designs put four related titles in a row, whatever the tablet's width. */
export const RELATED_COLUMNS = 4;

export type TabletMetrics = {
  backTopInset: number;
  blockGap: number;
  buttonWidth: number;
  buttonsToTabsGap: number;
  channelLogoBottom: number;
  channelLogoSize: number;
  contentTopGap: number;
  /** The tablet the designs were drawn on. */
  frameWidth: number;
  heroBottomGradientRatio: number;
  heroLeftGradientRatio: number;
  /** The size the designs give the hero on that tablet. */
  heroWidth: number;
  sectionGap: number;
  /** Width the title, synopsis and progress bar wrap at. */
  textMaxWidth: number;
};

const TABLET_METRICS: Record<"landscape" | "portrait", TabletMetrics> = {
  landscape: {
    backTopInset: 37,
    blockGap: 18,
    buttonWidth: 263,
    buttonsToTabsGap: 87,
    channelLogoBottom: 46,
    channelLogoSize: 85,
    contentTopGap: 46,
    frameWidth: 1180,
    heroBottomGradientRatio: 173 / 419,
    heroLeftGradientRatio: 253 / 745,
    heroWidth: 745,
    sectionGap: 16,
    textMaxWidth: 700,
  },
  portrait: {
    backTopInset: 24,
    blockGap: 16,
    buttonWidth: 174,
    buttonsToTabsGap: 38,
    channelLogoBottom: 18,
    channelLogoSize: 60,
    contentTopGap: 65,
    frameWidth: 820,
    heroBottomGradientRatio: 150 / 315,
    heroLeftGradientRatio: 180 / 560,
    heroWidth: 560,
    sectionGap: 8,
    textMaxWidth: 471,
  },
};

export function getTabletMetrics(isLandscape: boolean): TabletMetrics {
  return TABLET_METRICS[isLandscape ? "landscape" : "portrait"];
}

/** The header keeps the designs' proportions, and only shrinks on a narrower tablet. */
function getDesignScale({
  metrics,
  width,
}: {
  metrics: TabletMetrics;
  width: number;
}) {
  return Math.min(1, width / metrics.frameWidth);
}

/**
 * A layout rule, not a JS number, so the hero resizes with the rotate:
 * the portrait share of the width, capped at the landscape size.
 */
export const HERO_SIZE_STYLE: ViewStyle = {
  aspectRatio: HERO_ASPECT_RATIO,
  // Caps the height too, so the shape holds when the width cap applies.
  maxHeight: TABLET_METRICS.landscape.heroWidth / HERO_ASPECT_RATIO,
  maxWidth: TABLET_METRICS.landscape.heroWidth,
  width: `${(TABLET_METRICS.portrait.heroWidth / TABLET_METRICS.portrait.frameWidth) * 100}%`,
};

/** The title, synopsis and progress bar share the designs' text column. */
export function getTextMaxWidth({
  metrics,
  width,
}: {
  metrics: TabletMetrics;
  width: number;
}) {
  return metrics.textMaxWidth * getDesignScale({ metrics, width });
}

/** A tile takes its share of the row, so the count holds on any tablet. */
export function getRelatedTileWidth(availableWidth: number) {
  return (
    (availableWidth - RELATED_TILE_GAP * (RELATED_COLUMNS - 1)) /
    RELATED_COLUMNS
  );
}
