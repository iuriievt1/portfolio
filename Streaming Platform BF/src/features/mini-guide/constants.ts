import type { MiniGuideVariant } from "./types";

type MiniGuideCommonDimensions = {
  collapsedRowHeight: number;
  focusedRowHeight: number;
  logoWidth: number;
  metadataDescriptionGap: number;
  metadataFontSize: number;
  metadataLineHeight: number;
  nextColumnFlex: number;
  nowColumnFlex: number;
  panelHeight: number;
  panelHorizontalPadding: number;
  panelPaddingRight: number;
  rowGap: number;
  rowsPanelHeight: number;
  showDescription: boolean;
  showNowThumbnail: boolean;
  tileGap: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleMetadataGap: number;
};

type MiniGuideVariantDimensions =
  | (MiniGuideCommonDimensions & { centerContent: true })
  | (MiniGuideCommonDimensions & {
      cellPaddingVertical: {
        next: { collapsed: number; focused: number };
        now: { collapsed: number; focused: number };
      };
      centerContent: false;
      longerTitle: {
        nextPaddingVertical: number;
        nowPaddingVertical: number;
        titleFontSize: number;
        titleLineHeight: number;
      } | null;
    });

export const MINI_GUIDE_DIMENSIONS: Record<
  MiniGuideVariant,
  MiniGuideVariantDimensions
> = {
  mobile: {
    cellPaddingVertical: {
      next: { collapsed: 27, focused: 34 },
      now: { collapsed: 30.5, focused: 28 },
    },
    centerContent: false,
    collapsedRowHeight: 87,
    focusedRowHeight: 101,
    logoWidth: 90,
    longerTitle: {
      nextPaddingVertical: 27,
      nowPaddingVertical: 7,
      titleFontSize: 22,
      titleLineHeight: 26,
    },
    metadataDescriptionGap: 8,
    metadataFontSize: 12,
    metadataLineHeight: 12,
    nextColumnFlex: 237,
    nowColumnFlex: 433,
    panelHeight: 246,
    panelHorizontalPadding: 16,
    panelPaddingRight: 17,
    rowGap: 8,
    rowsPanelHeight: 172,
    showDescription: false,
    showNowThumbnail: false,
    tileGap: 8,
    titleFontSize: 14,
    titleLineHeight: 14,
    titleMetadataGap: 4,
  },
  "tablet-landscape": {
    centerContent: true,
    collapsedRowHeight: 87,
    focusedRowHeight: 150,
    logoWidth: 124,
    metadataDescriptionGap: 8,
    metadataFontSize: 14,
    metadataLineHeight: 18,
    nextColumnFlex: 332,
    nowColumnFlex: 612,
    panelHeight: 464,
    panelHorizontalPadding: 40,
    panelPaddingRight: 40,
    rowGap: 8,
    rowsPanelHeight: 415,
    showDescription: true,
    showNowThumbnail: true,
    tileGap: 16,
    titleFontSize: 16,
    titleLineHeight: 18,
    titleMetadataGap: 4,
  },
  "tablet-portrait": {
    centerContent: true,
    collapsedRowHeight: 87,
    focusedRowHeight: 150,
    logoWidth: 126,
    metadataDescriptionGap: 8,
    metadataFontSize: 14,
    metadataLineHeight: 18,
    nextColumnFlex: 222,
    nowColumnFlex: 361,
    panelHeight: 464,
    panelHorizontalPadding: 40,
    panelPaddingRight: 39,
    rowGap: 16,
    rowsPanelHeight: 415,
    showDescription: true,
    showNowThumbnail: false,
    tileGap: 16,
    titleFontSize: 16,
    titleLineHeight: 18,
    titleMetadataGap: 4,
  },
};

export const MINI_GUIDE_TILE = {
  borderRadius: 8,
  descriptionFontSize: 14,
  descriptionLineHeight: 17,
  focusedBorderWidth: 2,
  gap: 8,
  horizontalPadding: 16,
  logoFallbackFontSize: 14,
  logoFallbackLineHeight: 20,
  logoImageHeight: 30,
  logoImageWidth: 45,
  progressBarGap: 8,
  progressBarHeight: 4,
  rowsPanelRadius: 16,
  thumbnailHeight: 100,
  thumbnailRadius: 4,
  thumbnailWidth: 176,
  verticalPadding: 16,
} as const;

export const MINI_GUIDE_PANEL = {
  labelFontSize: 16,
  labelLineHeight: 20,
  rowGap: 8,
} as const;
