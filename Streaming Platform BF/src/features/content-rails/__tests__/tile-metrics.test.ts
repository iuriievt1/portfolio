import { ContentCategoryTemplate } from "@bfbs/common-sdk";

import {
  getTileAspectRatio,
  getTilePresentation,
  getTileWidth,
  TILE_VARIANT,
} from "@/features/content-rails/utils/tile-metrics";

describe("getTilePresentation", () => {
  it.each([
    [
      ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
      TILE_VARIANT.LANDSCAPE,
      "standard",
    ],
    [
      ContentCategoryTemplate.SIXTEEN_BY_NINE_LARGE,
      TILE_VARIANT.LANDSCAPE,
      "large",
    ],
    [
      ContentCategoryTemplate.SQUARE_SMALL,
      TILE_VARIANT.SQUARE_CARD,
      "standard",
    ],
    [ContentCategoryTemplate.SQUARE_LARGE, TILE_VARIANT.SQUARE_CARD, "large"],
    [
      ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
      TILE_VARIANT.VERTICAL,
      "standard",
    ],
    [
      ContentCategoryTemplate.NINE_BY_SIXTEEN_LARGE,
      TILE_VARIANT.VERTICAL,
      "large",
    ],
  ] as const)("maps %s to its designed presentation", (template, variant, size) => {
    expect(getTilePresentation(template)).toEqual({
      size,
      variant,
    });
  });

  it.each([
    [ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL, "standard"],
    [ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_LARGE, "large"],
    [ContentCategoryTemplate.HERO, "large"],
  ] as const)("falls %s back to landscape while preserving its size category", (template, size) => {
    expect(getTilePresentation(template)).toEqual({
      size,
      variant: TILE_VARIANT.LANDSCAPE,
    });
  });

  it("uses the standard landscape fallback for an unknown runtime value", () => {
    expect(getTilePresentation("UNKNOWN" as ContentCategoryTemplate)).toEqual({
      size: "standard",
      variant: TILE_VARIANT.LANDSCAPE,
    });
  });

  it.each([
    ["standard", 168],
    ["large", 233],
  ] as const)("uses the received square size on phone (size: %s)", (size, width) => {
    expect(
      getTileWidth({
        isTablet: false,
        size,
        variant: TILE_VARIANT.SQUARE_CARD,
      }),
    ).toBe(width);
  });

  it.each([
    [false, "standard", 173],
    [false, "large", 220],
    [true, "standard", 193],
    [true, "large", 263],
  ] as const)("uses the received square size on tablet (landscape: %s, size: %s)", (isLandscape, size, width) => {
    expect(
      getTileWidth({
        isLandscape,
        isTablet: true,
        size,
        variant: TILE_VARIANT.SQUARE_CARD,
      }),
    ).toBe(width);
  });

  it.each([
    ["phone", false, false, 168, 297],
    ["tabletPortrait", true, false, 173, 308],
    ["tabletLandscape", true, true, 192, 342],
  ] as const)("uses the exact standard vertical dimensions for %s", (formFactor, isTablet, isLandscape, width, height) => {
    expect(
      getTileWidth({
        isLandscape,
        isTablet,
        size: "standard",
        variant: TILE_VARIANT.VERTICAL,
      }),
    ).toBe(width);
    expect(
      getTileAspectRatio(TILE_VARIANT.VERTICAL, {
        formFactor,
        size: "standard",
      }),
    ).toBe(width / height);
  });
});
