import {
  getRelatedTileWidth,
  getTabletMetrics,
  getTextMaxWidth,
  HERO_SIZE_STYLE,
  RELATED_COLUMNS,
  TABLET_HORIZONTAL_INSET,
} from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";

const HERO_ASPECT_RATIO = 16 / 9;
const DESIGN_PORTRAIT_WIDTH = 820;
const DESIGN_LANDSCAPE_WIDTH = 1180;
const LARGE_TABLET_WIDTH = 1032;
const SMALL_TABLET_WIDTH = 800;
const NARROW_TABLET_WIDTH = 600;

function tileWidthOn(screenWidth: number) {
  return getRelatedTileWidth(screenWidth - TABLET_HORIZONTAL_INSET * 2);
}

// Applies the hero rule as the layout does: a share of the width, capped.
function heroOn(screenWidth: number) {
  const share = Number.parseFloat(String(HERO_SIZE_STYLE.width)) / 100;
  const width = Math.min(screenWidth * share, Number(HERO_SIZE_STYLE.maxWidth));

  return { height: Math.round(width / HERO_ASPECT_RATIO), width };
}

describe("related grid metrics", () => {
  test("holds four titles in a row", () => {
    expect(RELATED_COLUMNS).toBe(4);
  });

  test("matches the designs on the tablet they were drawn for", () => {
    expect(tileWidthOn(DESIGN_PORTRAIT_WIDTH)).toBe(173);
    expect(tileWidthOn(DESIGN_LANDSCAPE_WIDTH)).toBe(263);
  });

  test("stretches the tile on other tablets instead of changing the count", () => {
    expect(tileWidthOn(LARGE_TABLET_WIDTH)).toBe(226);
    expect(tileWidthOn(SMALL_TABLET_WIDTH)).toBe(168);
  });
});

function textWidthOn(screenWidth: number, isLandscape = false) {
  return getTextMaxWidth({
    metrics: getTabletMetrics(isLandscape),
    width: screenWidth,
  });
}

describe("hero metrics", () => {
  test("matches the designs on the tablet they were drawn for", () => {
    expect(heroOn(DESIGN_PORTRAIT_WIDTH)).toEqual({ height: 315, width: 560 });
    expect(heroOn(DESIGN_LANDSCAPE_WIDTH)).toEqual({
      height: 419,
      width: 745,
    });
  });

  test("grows up to the landscape size on a tablet wider than the designs", () => {
    expect(heroOn(LARGE_TABLET_WIDTH).width).toBeCloseTo(704.8, 1);
    expect(heroOn(1366)).toEqual({ height: 419, width: 745 });
  });

  test("shrinks with the screen on a tablet narrower than the designs", () => {
    expect(heroOn(SMALL_TABLET_WIDTH).width).toBeCloseTo(546.3, 1);
    expect(heroOn(NARROW_TABLET_WIDTH).width).toBeCloseTo(409.8, 1);
  });
});

describe("text column metrics", () => {
  test("matches the designs on the tablet they were drawn for", () => {
    expect(textWidthOn(DESIGN_PORTRAIT_WIDTH)).toBe(471);
    expect(textWidthOn(DESIGN_LANDSCAPE_WIDTH, true)).toBe(700);
  });

  test("stops growing on a tablet wider than the designs", () => {
    expect(textWidthOn(LARGE_TABLET_WIDTH)).toBe(471);
    expect(textWidthOn(1366, true)).toBe(700);
  });

  test("shrinks with the screen on a tablet narrower than the designs", () => {
    expect(textWidthOn(SMALL_TABLET_WIDTH)).toBeCloseTo(459.5, 1);
    expect(textWidthOn(NARROW_TABLET_WIDTH)).toBeCloseTo(344.6, 1);
  });
});
