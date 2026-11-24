import type { ContentCategoryTemplate, ContentRail } from "@bfbs/common-sdk";
import type { TileFormFactor, TileSize } from "@/features/content-rails/types";

import { capLeading } from "@/utils/typography";

/** Measured from Figma. */
export const TILE_CORNER_RADIUS = 8;
export const TILE_LABEL_SIZE = 14;
export const TILE_LABEL_LINE_HEIGHT = 18;
/** Figma's -1.1%. */
export const TILE_LABEL_LETTER_SPACING = -0.15;
export const TILE_LABEL_LINES = 2;
/** Artwork to label cap. */
const TILE_LABEL_GAP = 8;
export const TILE_LABEL_MARGIN_TOP =
  TILE_LABEL_GAP - capLeading(TILE_LABEL_SIZE);

/** Logo box, top left. */
export const TILE_CHANNEL_LOGO_INSET = 8;
export const TILE_CHANNEL_LOGO_HEIGHT = 20;
export const TILE_CHANNEL_LOGO_MAX_WIDTH = 45;

/** Bottom-right rank badge, from Figma. */
export type TileRankBadge = {
  readonly width: number;
  readonly height: number;
  /** Digits are 0.71 of this. */
  readonly fontSize: number;
  /** Number centre and baseline, inside the badge. */
  readonly numberX: number;
  readonly numberY: number;
};

const SMALL_RANK_BADGE: TileRankBadge = {
  width: 86,
  height: 60,
  fontSize: 28,
  numberX: 72.5,
  numberY: 54,
};

const BIG_RANK_BADGE: TileRankBadge = {
  width: 142,
  height: 100,
  fontSize: 42,
  numberX: 114.5,
  numberY: 89,
};

export const TILE_RANK_BADGE: Record<
  TileFormFactor,
  Record<TileSize, TileRankBadge>
> = {
  phone: { large: BIG_RANK_BADGE, standard: SMALL_RANK_BADGE },
  tabletPortrait: { large: BIG_RANK_BADGE, standard: SMALL_RANK_BADGE },
  tabletLandscape: { large: BIG_RANK_BADGE, standard: BIG_RANK_BADGE },
};
export const TILE_RANK_STROKE_WIDTH = 1;

/** One label line. */
export const TILE_LABEL_BLOCK_HEIGHT =
  TILE_LABEL_MARGIN_TOP + TILE_LABEL_LINE_HEIGHT;

export const TILE_VARIANT = {
  LANDSCAPE: "landscape",
  SQUARE_CARD: "squareCard",
  VERTICAL: "vertical",
} as const;

export type TileVariant = (typeof TILE_VARIANT)[keyof typeof TILE_VARIANT];

export type TilePresentation = {
  readonly size: TileSize;
  readonly variant: TileVariant;
};

export const TILE_ASPECT_RATIO = 16 / 9;

const SQUARE_ASPECT_RATIO = 1;
const VERTICAL_ASPECT_RATIO = 9 / 16;
const STANDARD_VERTICAL_HEIGHT: Record<TileFormFactor, number> = {
  phone: 297,
  tabletPortrait: 308,
  tabletLandscape: 342,
};

const DEFAULT_TILE_PRESENTATION: TilePresentation = {
  size: "standard",
  variant: TILE_VARIANT.LANDSCAPE,
};

const TILE_PRESENTATION_BY_TEMPLATE = {
  HERO: {
    size: "large",
    variant: TILE_VARIANT.LANDSCAPE,
  },
  NINE_BY_SIXTEEN_LARGE: {
    size: "large",
    variant: TILE_VARIANT.VERTICAL,
  },
  NINE_BY_SIXTEEN_STANDARD: {
    size: "standard",
    variant: TILE_VARIANT.VERTICAL,
  },
  SIXTEEN_BY_NINE_DESIGNED_LARGE: {
    size: "large",
    variant: TILE_VARIANT.LANDSCAPE,
  },
  SIXTEEN_BY_NINE_DESIGNED_SMALL: DEFAULT_TILE_PRESENTATION,
  SIXTEEN_BY_NINE_LARGE: {
    size: "large",
    variant: TILE_VARIANT.LANDSCAPE,
  },
  SIXTEEN_BY_NINE_STANDARD: {
    size: "standard",
    variant: TILE_VARIANT.LANDSCAPE,
  },
  SQUARE_LARGE: {
    size: "large",
    variant: TILE_VARIANT.SQUARE_CARD,
  },
  SQUARE_SMALL: {
    size: "standard",
    variant: TILE_VARIANT.SQUARE_CARD,
  },
} satisfies Record<ContentCategoryTemplate, TilePresentation>;

/** Resolves an SDK template to the closest presentation Mobile can render. */
export function getTilePresentation(
  template: ContentCategoryTemplate,
): TilePresentation {
  return TILE_PRESENTATION_BY_TEMPLATE[template] ?? DEFAULT_TILE_PRESENTATION;
}

/** Tile aspect ratio for each provider-driven presentation. */
export function getTileAspectRatio(
  variant: TileVariant = TILE_VARIANT.LANDSCAPE,
  presentation?: {
    formFactor: TileFormFactor;
    size: TileSize;
  },
): number {
  if (variant === TILE_VARIANT.SQUARE_CARD) {
    return SQUARE_ASPECT_RATIO;
  }

  if (variant === TILE_VARIANT.VERTICAL && presentation?.size === "standard") {
    return (
      TILE_WIDTH[variant][presentation.formFactor][presentation.size] /
      STANDARD_VERTICAL_HEIGHT[presentation.formFactor]
    );
  }

  return variant === TILE_VARIANT.VERTICAL
    ? VERTICAL_ASPECT_RATIO
    : TILE_ASPECT_RATIO;
}

const TILE_WIDTH: Record<
  TileVariant,
  Record<TileFormFactor, Record<TileSize, number>>
> = {
  [TILE_VARIANT.LANDSCAPE]: {
    phone: { large: 255, standard: 168 },
    tabletPortrait: { large: 268, standard: 173 },
    tabletLandscape: { large: 333, standard: 263 },
  },
  [TILE_VARIANT.SQUARE_CARD]: {
    phone: { large: 233, standard: 168 },
    tabletPortrait: { large: 220, standard: 173 },
    tabletLandscape: { large: 263, standard: 193 },
  },
  [TILE_VARIANT.VERTICAL]: {
    phone: { large: 255, standard: 168 },
    tabletPortrait: { large: 268, standard: 173 },
    tabletLandscape: { large: 333, standard: 192 },
  },
};

/** Designed layout bucket. */
export function getTileFormFactor({
  isTablet,
  isLandscape,
}: {
  isTablet: boolean;
  isLandscape: boolean;
}): TileFormFactor {
  if (!isTablet) {
    return "phone";
  }

  return isLandscape ? "tabletLandscape" : "tabletPortrait";
}

/** Resolves the size category while retaining the existing rail-based API. */
export function getTileSize(rail: ContentRail): TileSize {
  return getTilePresentation(rail.template).size;
}

/** Designed tile width for the form factor, size and variant. */
export function getTileWidth({
  isTablet,
  isLandscape = false,
  size,
  variant = TILE_VARIANT.LANDSCAPE,
}: {
  isTablet: boolean;
  isLandscape?: boolean;
  size: TileSize;
  variant?: TileVariant;
}): number {
  return TILE_WIDTH[variant][getTileFormFactor({ isLandscape, isTablet })][
    size
  ];
}
