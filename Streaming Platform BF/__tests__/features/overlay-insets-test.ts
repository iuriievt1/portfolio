import type { PlayerOverlayLayout } from "@/features/video-player/components/player-overlay";
import { getPlayerOverlayInsets } from "@/features/video-player/utils/overlay-insets";

const TABLET_LANDSCAPE_BOTTOM_GAP = 27;
const TABLET_PORTRAIT_TOP_OFFSET = 28;
const TABLET_PORTRAIT_BOTTOM_OFFSET = 32;
const MOBILE_BOTTOM_OFFSET = 25;
const MOBILE_TOP_OFFSET = 34;

const noInsets = { bottom: 0, left: 0, right: 0, top: 0 };

function tabletLandscape(videoVerticalInset: number): PlayerOverlayLayout {
  return {
    isLandscape: true,
    isTablet: true,
    videoHorizontalInset: 0,
    videoVerticalInset,
  };
}

describe("getPlayerOverlayInsets - tablet landscape", () => {
  test("clears the system bars when they are taller than the video letterbox", () => {
    const { bottomOffset, topOffset } = getPlayerOverlayInsets({
      insets: { ...noInsets, bottom: 48, top: 24 },
      layout: tabletLandscape(20),
    });

    expect(bottomOffset).toBe(48 + TABLET_LANDSCAPE_BOTTOM_GAP);
    expect(topOffset).toBe(24 + TABLET_PORTRAIT_TOP_OFFSET);
  });

  test("keeps the letterbox-based offset when it already clears the system bars", () => {
    const { bottomOffset, topOffset } = getPlayerOverlayInsets({
      insets: { ...noInsets, bottom: 30, top: 20 },
      layout: tabletLandscape(60),
    });

    expect(bottomOffset).toBe(60 + TABLET_LANDSCAPE_BOTTOM_GAP);
    expect(topOffset).toBe(60 + TABLET_PORTRAIT_TOP_OFFSET);
  });
});

describe("getPlayerOverlayInsets - other layouts stay unchanged", () => {
  test("tablet portrait adds the bottom safe-area inset on top of its offset", () => {
    const { bottomOffset, topOffset } = getPlayerOverlayInsets({
      insets: { ...noInsets, bottom: 24, top: 18 },
      layout: {
        isLandscape: false,
        isTablet: true,
        videoHorizontalInset: 0,
        videoVerticalInset: 0,
      },
    });

    expect(bottomOffset).toBe(TABLET_PORTRAIT_BOTTOM_OFFSET + 24);
    expect(topOffset).toBe(18 + TABLET_PORTRAIT_TOP_OFFSET);
  });

  test("mobile adds the bottom safe-area inset and uses the mobile top offset", () => {
    const { bottomOffset, topOffset } = getPlayerOverlayInsets({
      insets: { ...noInsets, bottom: 34 },
      layout: {
        isLandscape: true,
        isTablet: false,
        videoHorizontalInset: 0,
        videoVerticalInset: 40,
      },
    });

    expect(bottomOffset).toBe(MOBILE_BOTTOM_OFFSET + 34);
    expect(topOffset).toBe(MOBILE_TOP_OFFSET);
  });
});
