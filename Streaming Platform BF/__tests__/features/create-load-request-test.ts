import type { PlaybackSourceType } from "@bfbs/common-sdk";

import { createLoadRequest } from "@/features/video-player/utils/create-load-request";

const base = {
  sourceType: "hls" as PlaybackSourceType,
  title: "Hidden Assets",
  url: "https://example.com/stream.m3u8",
};

describe("createLoadRequest", () => {
  test("includes the DRM config when the source has one", () => {
    const request = createLoadRequest({
      ...base,
      drm: { widevine: { licenseUrl: "https://la.example" } },
    });

    expect(request.drm).toEqual({
      widevine: { licenseUrl: "https://la.example" },
    });
  });

  test("omits DRM for a clear stream", () => {
    const request = createLoadRequest(base);

    expect(request).not.toHaveProperty("drm");
  });
});
