import { ContentThumbnailDisplay } from "@bfbs/common-sdk";

import {
  forceHttpsUrl,
  pickChannelLogoUrl,
  pickProgrammeImageUrl,
  resolveRailThumbnail,
} from "@/utils/media";

describe("forceHttpsUrl", () => {
  test("upgrades http to https", () => {
    expect(forceHttpsUrl("http://images.test/a.jpg")).toBe(
      "https://images.test/a.jpg",
    );
  });

  test("leaves https untouched", () => {
    expect(forceHttpsUrl("https://images.test/a.jpg")).toBe(
      "https://images.test/a.jpg",
    );
  });
});

describe("pickProgrammeImageUrl", () => {
  test("returns the first usable image as https", () => {
    expect(
      pickProgrammeImageUrl([
        { mimeType: "image/jpeg", url: "http://images.test/first.jpg" },
        { mimeType: "image/jpeg", url: "https://images.test/second.jpg" },
      ]),
    ).toBe("https://images.test/first.jpg");
  });

  test("returns undefined when there is no media", () => {
    expect(pickProgrammeImageUrl(undefined)).toBeUndefined();
    expect(pickProgrammeImageUrl([])).toBeUndefined();
  });
});

describe("pickChannelLogoUrl", () => {
  test("prefers media typed as a logo over other media", () => {
    expect(
      pickChannelLogoUrl([
        { mimeType: "image/png", url: "https://images.test/backdrop.png" },
        {
          mimeType: "image/png",
          type: "channel-logo",
          url: "https://images.test/logo.png",
        },
      ]),
    ).toBe("https://images.test/logo.png");
  });

  test("falls back to the first usable image when nothing is typed", () => {
    expect(
      pickChannelLogoUrl([
        { mimeType: "image/png", url: "https://images.test/backdrop.png" },
      ]),
    ).toBe("https://images.test/backdrop.png");
  });

  test("returns undefined when there is no media", () => {
    expect(pickChannelLogoUrl(undefined)).toBeUndefined();
  });
});

describe("resolveRailThumbnail", () => {
  const logo = {
    mimeType: "image/png",
    type: "channel_logo",
    url: "https://img/logo.png",
  };
  const inverted = {
    mimeType: "image/png",
    type: "inverted",
    url: "https://img/inverted.png",
  };
  const poster = {
    mimeType: "image/png",
    type: "poster",
    url: "https://img/poster.png",
  };
  const media = [logo, inverted, poster];

  test("uses regular channel artwork and never substitutes an inverted logo", () => {
    const regular = {
      mimeType: "image/png",
      type: "regular",
      url: "https://img/regular.png",
    };

    expect(
      resolveRailThumbnail({
        aspectRatio: 1,
        media: [{ ...inverted, type: "channel_logo_inverted" }, regular],
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_LOGO,
      }),
    ).toEqual({ contentFit: "contain", url: regular.url });
  });

  test.each([
    [ContentThumbnailDisplay.CHANNEL_LOGO, logo.url, "contain"],
    [ContentThumbnailDisplay.CHANNEL_LOGO_INVERTED, inverted.url, "contain"],
    [ContentThumbnailDisplay.CHANNEL_POSTER, poster.url, "cover"],
    [ContentThumbnailDisplay.EVENT_POSTER, poster.url, "cover"],
    [ContentThumbnailDisplay.EVENT_POSTER_WITH_TITLE, poster.url, "cover"],
  ] as const)("picks the image %s asks for", (variant, url, contentFit) => {
    expect(
      resolveRailThumbnail({
        aspectRatio: 1,
        media,
        thumbnailDisplay: variant,
      }),
    ).toEqual({ contentFit, url });
  });

  test("does not substitute an unrelated image for a configured thumbnail", () => {
    expect(
      resolveRailThumbnail({
        aspectRatio: 1,
        media: [inverted],
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_LOGO,
      }),
    ).toBeUndefined();
  });

  test("uses the image closest to the tile when the rail names no variant", () => {
    expect(
      resolveRailThumbnail({
        aspectRatio: 16 / 9,
        media: [
          { ...logo, height: 400, width: 400 },
          { ...poster, height: 900, width: 1600 },
        ],
      }),
    ).toEqual({ contentFit: "cover", url: poster.url });
  });

  test("uses fallback media only when placement media cannot satisfy the request", () => {
    expect(
      resolveRailThumbnail({
        aspectRatio: 1,
        fallbackMedia: [inverted],
        media: [],
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_LOGO_INVERTED,
      }),
    ).toEqual({ contentFit: "contain", url: inverted.url });
  });

  test("upgrades an http url", () => {
    expect(
      resolveRailThumbnail({
        aspectRatio: 1,
        media: [{ ...inverted, url: "http://img/i.png" }],
        thumbnailDisplay: ContentThumbnailDisplay.CHANNEL_LOGO_INVERTED,
      }),
    ).toEqual({ contentFit: "contain", url: "https://img/i.png" });
  });
});
