export const TABLET_ARTWORK_GAP = 14;
export const TABLET_BACK_ICON_SIZE = 20;
export const TABLET_BLOCK_GAP = 16;
export const TABLET_EDGE_INSET = 40;
export const TABLET_LOGO_TOP_INSET = 17;

type ChannelDetailsTabletMetrics = {
  artworkWidthRatio: number;
  backTopInsetRatio: number;
  bandRatio: number;
  buttonWidthRatio: number;
  logoSizeRatio: number;
  titleGapRatio: number;
};

const TABLET_METRICS: Record<
  "landscape" | "portrait",
  ChannelDetailsTabletMetrics
> = {
  landscape: {
    artworkWidthRatio: 472 / 1180,
    backTopInsetRatio: 37 / 1180,
    bandRatio: 464 / 1180,
    buttonWidthRatio: 263 / 614,
    logoSizeRatio: 85 / 1180,
    titleGapRatio: 54 / 1180,
  },
  portrait: {
    artworkWidthRatio: 362 / 820,
    backTopInsetRatio: 24 / 820,
    bandRatio: 374 / 820,
    buttonWidthRatio: 174 / 364,
    logoSizeRatio: 60 / 820,
    titleGapRatio: 38 / 820,
  },
};

/**
 * Tablet metrics for the live channel page. What the designs scale between the
 * two frames is a ratio of the window width, so any tablet keeps the proportions.
 */
export function getChannelDetailsTabletMetrics({
  isLandscape,
  width,
}: {
  isLandscape: boolean;
  width: number;
}) {
  const ratios = TABLET_METRICS[isLandscape ? "landscape" : "portrait"];
  const artworkWidth = Math.round(width * ratios.artworkWidthRatio);
  const columnWidth =
    width - TABLET_EDGE_INSET * 2 - TABLET_ARTWORK_GAP - artworkWidth;

  return {
    artworkWidth,
    backTopInset: Math.round(width * ratios.backTopInsetRatio),
    bandHeight: Math.round(width * ratios.bandRatio),
    buttonWidth: Math.round(columnWidth * ratios.buttonWidthRatio),
    logoSize: Math.round(width * ratios.logoSizeRatio),
    titleGap: Math.round(width * ratios.titleGapRatio),
  };
}
