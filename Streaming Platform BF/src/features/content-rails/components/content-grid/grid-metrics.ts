import type { TileFormFactor } from "@/features/content-rails/types";
import { TILE_LABEL_SIZE } from "@/features/content-rails/utils/tile-metrics";
import { capLeading } from "@/utils/typography";

/** Measured from Figma. */
export const GRID_SIDE_PADDING = 15;
export const TABLET_GRID_SIDE_PADDING = 40;
export const GRID_COLUMN_GAP = 8;
export const TABLET_GRID_COLUMN_GAP = 16;
export const GRID_PADDING_BOTTOM = 24;

export const GRID_BACK_ICON_SIZE = 20;
export const GRID_BACK_LABEL_GAP = 10;
export const GRID_BACK_LABEL_LINE_HEIGHT = 20;

export const GRID_TITLE_LINES = 2;
/** Figma's -0.4%. */
const GRID_TITLE_TRACKING = -0.004;
/** Fixed in the design. */
export const GRID_TITLE_BLOCK_MIN_HEIGHT = 80;
/** Block top to cap. */
const GRID_TITLE_CAP_OFFSET = 26;
/** List margin, survives scrolling. */
export const GRID_LIST_MARGIN_TOP = 24;
/** Label cap to next row. */
const GRID_ROW_GAP = 24;

export const GRID_LIST_ROW_GAP = GRID_ROW_GAP - capLeading(TILE_LABEL_SIZE);

type GridHeaderDesign = {
  backLabelSize: number;
  /** Below the status bar. */
  backMarginTop: number;
  titleBlockMarginTop: number;
  titleSize: number;
};

const TABLET_HEADER_DESIGN: GridHeaderDesign = {
  backLabelSize: 16,
  backMarginTop: 23,
  titleBlockMarginTop: 56,
  titleSize: 38,
};

const GRID_HEADER_DESIGN: Record<TileFormFactor, GridHeaderDesign> = {
  phone: {
    backLabelSize: 14,
    backMarginTop: 16,
    titleBlockMarginTop: 32,
    titleSize: 36,
  },
  tabletLandscape: TABLET_HEADER_DESIGN,
  tabletPortrait: TABLET_HEADER_DESIGN,
};

export type GridHeaderMetrics = GridHeaderDesign & {
  /** Where the list starts. */
  height: number;
  titleLetterSpacing: number;
  titlePaddingTop: number;
};

/** Header metrics per form factor. */
export function getGridHeaderMetrics(
  formFactor: TileFormFactor,
): GridHeaderMetrics {
  const design = GRID_HEADER_DESIGN[formFactor];

  return {
    ...design,
    height:
      design.backMarginTop +
      GRID_BACK_ICON_SIZE +
      design.titleBlockMarginTop +
      GRID_TITLE_BLOCK_MIN_HEIGHT +
      GRID_LIST_MARGIN_TOP,
    titleLetterSpacing: design.titleSize * GRID_TITLE_TRACKING,
    titlePaddingTop: GRID_TITLE_CAP_OFFSET - capLeading(design.titleSize),
  };
}
