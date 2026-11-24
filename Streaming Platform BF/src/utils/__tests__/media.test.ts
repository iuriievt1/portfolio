import type { MediaImage } from "@bfbs/common-sdk";

import { pickImageUrlForAspectRatio, pickTitleArt } from "../media";

const WIDE_TILE = 16 / 9;
const PORTRAIT_TILE = 2 / 3;
const POSTER_URL = "https://example.com/poster.jpg";
const WIDE_URL = "https://example.com/wide.jpg";
const FIRST_URL = "https://example.com/first.jpg";
const NEUTRAL_URL = "https://example.com/neutral.png";
const DARK_URL = "https://example.com/dark.png";

function createImage(image: Partial<MediaImage>): MediaImage {
  return { mimeType: "image/jpeg", url: "", ...image };
}

const poster = createImage({ height: 1620, url: POSTER_URL, width: 1080 });
const wide = createImage({ height: 1080, url: WIDE_URL, width: 1920 });

describe("pickImageUrlForAspectRatio", () => {
  it("picks the image closest in shape to the tile", () => {
    expect(pickImageUrlForAspectRatio([poster, wide], WIDE_TILE)).toBe(
      WIDE_URL,
    );
    expect(pickImageUrlForAspectRatio([wide, poster], PORTRAIT_TILE)).toBe(
      POSTER_URL,
    );
  });

  it("picks the larger image when two fit equally well", () => {
    const small = createImage({
      height: 270,
      url: "https://example.com/small.jpg",
      width: 480,
    });

    expect(pickImageUrlForAspectRatio([small, wide], WIDE_TILE)).toBe(WIDE_URL);
  });

  it("skips images without a width, height or url", () => {
    const media = [
      createImage({ height: 1080, width: 1920 }),
      createImage({ height: 1080, url: "https://example.com/no-width.jpg" }),
      createImage({ url: "https://example.com/no-height.jpg", width: 1920 }),
      poster,
    ];

    expect(pickImageUrlForAspectRatio(media, WIDE_TILE)).toBe(POSTER_URL);
  });

  it("falls back to the first image when no image has a size", () => {
    const media = [
      createImage({ url: FIRST_URL }),
      createImage({ url: "https://example.com/second.jpg" }),
    ];

    expect(pickImageUrlForAspectRatio(media, WIDE_TILE)).toBe(FIRST_URL);
  });

  it("returns undefined when there are no images", () => {
    expect(pickImageUrlForAspectRatio(undefined, WIDE_TILE)).toBeUndefined();
    expect(pickImageUrlForAspectRatio([], WIDE_TILE)).toBeUndefined();
  });

  it("upgrades http URLs to https", () => {
    const sized = createImage({
      height: 1080,
      url: "http://example.com/wide.jpg",
      width: 1920,
    });
    const unsized = createImage({ url: "http://example.com/first.jpg" });

    expect(pickImageUrlForAspectRatio([sized], WIDE_TILE)).toBe(WIDE_URL);
    expect(pickImageUrlForAspectRatio([unsized], WIDE_TILE)).toBe(FIRST_URL);
  });

  it("skips title art", () => {
    const titleArt = createImage({
      height: 1000,
      type: "titleTreatmentNeutral",
      url: NEUTRAL_URL,
      width: 1800,
    });

    expect(pickImageUrlForAspectRatio([titleArt, poster], WIDE_TILE)).toBe(
      POSTER_URL,
    );
  });
});

describe("pickTitleArt", () => {
  const neutral = createImage({
    height: 1000,
    type: "titleTreatmentNeutral",
    url: "http://example.com/neutral.png",
    width: 1800,
  });
  const dark = createImage({
    height: 1000,
    type: "titleTreatmentDark",
    url: DARK_URL,
    width: 1800,
  });

  it("picks the neutral title art as https, with its shape", () => {
    expect(pickTitleArt([dark, neutral])).toEqual({
      aspectRatio: 1.8,
      url: NEUTRAL_URL,
    });
  });

  it("falls back to the dark title art", () => {
    expect(pickTitleArt([dark])?.url).toBe(DARK_URL);
  });

  it("returns undefined when there is no title art", () => {
    const media = [
      createImage({ type: "None", url: WIDE_URL }),
      createImage({ type: "backdrop", url: WIDE_URL }),
    ];

    expect(pickTitleArt(media)).toBeUndefined();
    expect(pickTitleArt(undefined)).toBeUndefined();
  });

  it("leaves out the shape when the image has no size", () => {
    const unsized = createImage({
      type: "titleTreatmentNeutral",
      url: NEUTRAL_URL,
    });

    expect(pickTitleArt([unsized])).toEqual({
      aspectRatio: undefined,
      url: NEUTRAL_URL,
    });
  });
});
