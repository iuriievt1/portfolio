import type { MediaImage } from "@bfbs/common-sdk";

// Same side gaps as the phone and tablet designs.
const PHONE_SIDE_INSET = 16;
const TABLET_SIDE_INSET = 40;

/** The page width minus the design's side gaps. */
export function getPromoBannerWidth(screenWidth: number, isTablet: boolean) {
  return screenWidth - (isTablet ? TABLET_SIDE_INSET : PHONE_SIDE_INSET) * 2;
}

const getAspectRatio = ({ height = 1, width = 0 }: MediaImage) =>
  width / height;

const byWidestFirst = (first: MediaImage, second: MediaImage) =>
  (second.width ?? 0) - (first.width ?? 0);

// Picks the phone image with the lowest aspect ratio (tallest).
function pickPhoneImage(media: MediaImage[]) {
  const sized = media.filter(({ height, width }) => height && width);
  const lowestRatio = Math.min(...sized.map(getAspectRatio));

  return sized
    .filter((image) => getAspectRatio(image) === lowestRatio)
    .sort(byWidestFirst)[0];
}

/** Picks the best-fitting image for the device and screen width. */
export function pickPromoImage(
  media: MediaImage[] | undefined,
  screenWidth: number,
  isTablet: boolean,
) {
  if (!isTablet) {
    return pickPhoneImage(media ?? []);
  }

  const sized = (media ?? []).filter(({ height, width }) => height && width);
  const fitting = sized.filter(({ width = 0 }) => width <= screenWidth);
  const widest = fitting.sort(byWidestFirst)[0];

  return widest ?? sized[0];
}
