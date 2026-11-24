import {
  getColumnWidth,
  getGuideMetrics,
  getRowHeight,
} from "@/features/full-guide";

const PHONE = getGuideMetrics({ isLandscape: false, isTablet: false });
const PORTRAIT = getGuideMetrics({ isLandscape: false, isTablet: true });
const LANDSCAPE = getGuideMetrics({ isLandscape: true, isTablet: true });

describe("guide metrics", () => {
  test("keeps a phone phone-shaped when it is turned", () => {
    expect(getGuideMetrics({ isLandscape: true, isTablet: false })).toEqual(
      PHONE,
    );
  });

  test("gives a tablet wider cards once it is turned", () => {
    expect(LANDSCAPE.tileWidth).toBeGreaterThan(PORTRAIT.tileWidth);
  });

  test("measures a row as its cards plus the air under them", () => {
    expect(getRowHeight(PHONE)).toBe(PHONE.cellHeight + PHONE.rowGap);
  });

  test("measures a column as the pinned tile with its margins", () => {
    expect(getColumnWidth(PORTRAIT)).toBe(
      PORTRAIT.edgeInset + PORTRAIT.tileWidth + PORTRAIT.columnGap,
    );
  });
});
