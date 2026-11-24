import type { PlayerOverlayLayout } from "@/features/video-player/components/player-overlay";

const MOBILE_BOTTOM_OFFSET = 25;
const MOBILE_HORIZONTAL_INSET = 46;
const MOBILE_TOP_OFFSET = 34;
const TABLET_HORIZONTAL_INSET = 40;
const TABLET_LANDSCAPE_BOTTOM_GAP = 27;
const TABLET_PORTRAIT_BOTTOM_OFFSET = 32;
const TABLET_PORTRAIT_TOP_OFFSET = 28;

type SafeAreaInsets = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function getPlayerOverlayInsets({
  insets,
  layout,
}: {
  insets: SafeAreaInsets;
  layout: PlayerOverlayLayout;
}) {
  const isTabletLandscape = layout.isTablet && layout.isLandscape;
  const videoVerticalInset = isTabletLandscape ? layout.videoVerticalInset : 0;
  const videoHorizontalInset = isTabletLandscape
    ? layout.videoHorizontalInset
    : 0;
  let topOffset = MOBILE_TOP_OFFSET;

  if (isTabletLandscape) {
    topOffset =
      Math.max(videoVerticalInset, insets.top) + TABLET_PORTRAIT_TOP_OFFSET;
  } else if (layout.isTablet) {
    topOffset = insets.top + TABLET_PORTRAIT_TOP_OFFSET;
  }

  let bottomGap = MOBILE_BOTTOM_OFFSET;

  if (isTabletLandscape) {
    bottomGap =
      Math.max(videoVerticalInset, insets.bottom) + TABLET_LANDSCAPE_BOTTOM_GAP;
  } else if (layout.isTablet) {
    bottomGap = TABLET_PORTRAIT_BOTTOM_OFFSET;
  }

  const bottomOffset = isTabletLandscape
    ? bottomGap
    : bottomGap + insets.bottom;
  const horizontalSafeArea = Math.max(insets.left, insets.right);
  const horizontalInset = layout.isTablet
    ? TABLET_HORIZONTAL_INSET +
      Math.max(horizontalSafeArea, layout.videoHorizontalInset)
    : Math.max(MOBILE_HORIZONTAL_INSET, horizontalSafeArea);

  return {
    bottomOffset,
    horizontalInset,
    topOffset,
    videoHorizontalInset,
    videoVerticalInset,
  };
}
