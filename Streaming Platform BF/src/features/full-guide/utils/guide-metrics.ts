import {
  getTileFormFactor,
  type TileFormFactor,
} from "@/features/content-rails";
import { HERO_ASPECT_RATIO } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";

export type GuideMetrics = {
  cellGap: number;
  cellHeight: number;
  /** Width of the red live clock over the pointer; ruler marks clear it. */
  clockWidth: number;
  clockGap: number;
  columnGap: number;
  dayLabelHeight: number;
  daySize: number;
  edgeInset: number;
  /** The day row plus the air under it; the pointer sits on its bottom edge. */
  headerHeight: number;
  /** The hero artwork, measured against the window width the designs use. */
  heroArtworkHeightRatio: number;
  heroArtworkWidthRatio: number;
  heroButtonWidth: number | undefined;
  /** Width the title and synopsis wrap at, against the window width. */
  heroTextWidthRatio: number;
  heroGap: number;
  heroMetadataGap: number;
  heroTitleGap: number;
  heroSynopsisGap: number;
  logoHeight: number;
  logoWidth: number;
  pointerHeight: number;
  rowGap: number;
  rulerSize: number;
  subtitleSize: number;
  textGap: number;
  tileWidth: number;
  titleSize: number;
};

/** The border every programme card draws. */
export const CARD_BORDER = 2;

/** The corner radius of programme cards and channel tiles. */
export const CARD_RADIUS = 8;

const DAY_LABEL_HEIGHT = 20;
const FONT_WIDTH_SCALE = 1.05;
const LANDSCAPE_FRAME_WIDTH = 1180;
const PORTRAIT_FRAME_WIDTH = 820;
const TABLET_POINTER_HEIGHT = 10.28;

const SHARED_METRICS = {
  cellGap: 10,
  clockGap: 5.5,
  dayLabelHeight: DAY_LABEL_HEIGHT,
  heroSynopsisGap: 16,
  heroTitleGap: 16,
  logoHeight: 25,
  logoWidth: 45,
  rowGap: 10,
};

const GUIDE_METRICS: Record<TileFormFactor, GuideMetrics> = {
  phone: {
    ...SHARED_METRICS,
    cellHeight: 80,
    clockWidth: 31,
    columnGap: 8,
    daySize: 12,
    edgeInset: 16,
    headerHeight: 30,
    heroArtworkHeightRatio: 1 / HERO_ASPECT_RATIO,
    heroArtworkWidthRatio: 1,
    heroButtonWidth: undefined,
    heroGap: 0,
    heroMetadataGap: 16,
    heroTextWidthRatio: 1,
    pointerHeight: 9.09,
    rulerSize: 12,
    subtitleSize: 14,
    textGap: 6,
    tileWidth: 80,
    titleSize: 16,
  },
  tabletPortrait: {
    ...SHARED_METRICS,
    cellHeight: 80,
    clockWidth: 39,
    columnGap: 16,
    daySize: 13,
    edgeInset: 40,
    headerHeight: DAY_LABEL_HEIGHT + 29 + TABLET_POINTER_HEIGHT,
    heroArtworkHeightRatio: 297 / PORTRAIT_FRAME_WIDTH,
    heroArtworkWidthRatio: 506 / PORTRAIT_FRAME_WIDTH,
    heroButtonWidth: 174,
    heroGap: 32,
    heroMetadataGap: 10,
    heroTextWidthRatio: (389 * FONT_WIDTH_SCALE) / PORTRAIT_FRAME_WIDTH,
    pointerHeight: TABLET_POINTER_HEIGHT,
    rulerSize: 15,
    subtitleSize: 12,
    textGap: 6,
    tileWidth: 80,
    titleSize: 18,
  },
  tabletLandscape: {
    ...SHARED_METRICS,
    cellHeight: 87,
    clockWidth: 39,
    columnGap: 16,
    daySize: 13,
    edgeInset: 40,
    headerHeight: DAY_LABEL_HEIGHT + 4 + TABLET_POINTER_HEIGHT,
    heroArtworkHeightRatio: 344 / LANDSCAPE_FRAME_WIDTH,
    heroArtworkWidthRatio: 652 / LANDSCAPE_FRAME_WIDTH,
    heroButtonWidth: 264,
    heroGap: 49.5,
    heroMetadataGap: 10,
    heroTextWidthRatio: (487 * FONT_WIDTH_SCALE) / LANDSCAPE_FRAME_WIDTH,
    pointerHeight: TABLET_POINTER_HEIGHT,
    rulerSize: 15,
    subtitleSize: 12,
    textGap: 4,
    tileWidth: 124,
    titleSize: 18,
  },
};

/** The metrics the designs give for the shape the viewer is holding. */
export function getGuideMetrics(layout: {
  isLandscape: boolean;
  isTablet: boolean;
}): GuideMetrics {
  return GUIDE_METRICS[getTileFormFactor(layout)];
}

/** A row is its cards plus the air under them. */
export function getRowHeight(metrics: GuideMetrics) {
  return metrics.cellHeight + metrics.rowGap;
}

/** The pinned column: screen inset, channel tile, and the gap to the first cell. */
export function getColumnWidth(metrics: GuideMetrics) {
  return metrics.edgeInset + metrics.tileWidth + metrics.columnGap;
}
