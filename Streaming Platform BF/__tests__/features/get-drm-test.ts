import type { PlaySessionData } from "@bfbs/common-sdk";

import { getDrm } from "@/features/video-player/utils/get-drm";

function playSession(overrides: Partial<PlaySessionData>): PlaySessionData {
  return { id: "session-1", ...overrides } as PlaySessionData;
}

describe("getDrm", () => {
  test("maps wvDrm to widevine with licence URL and auth header", () => {
    const drm = getDrm(
      playSession({
        drmProperties: { blob: "token", laUrl: "https://la.example/wv" },
        drmType: "wvDrm",
      }),
    );

    expect(drm).toEqual({
      widevine: {
        headers: { Authorization: "Bearer token" },
        licenseUrl: "https://la.example/wv",
      },
    });
  });

  test("maps fpDrm to fairplay with the same licence data", () => {
    const drm = getDrm(
      playSession({
        drmProperties: { blob: "token", laUrl: "https://la.example/fp" },
        drmType: "fpDrm",
      }),
    );

    expect(drm).toEqual({
      fairplay: {
        headers: { Authorization: "Bearer token" },
        licenseUrl: "https://la.example/fp",
      },
    });
  });

  test("adds the FairPlay certificate URL when provided", () => {
    const drm = getDrm(
      playSession({
        drmProperties: { blob: "token", laUrl: "https://la.example/fp" },
        drmType: "fpDrm",
      }),
      "https://cert.example/fairplay",
    );

    expect(drm).toEqual({
      fairplay: {
        certificateUrl: "https://cert.example/fairplay",
        headers: { Authorization: "Bearer token" },
        licenseUrl: "https://la.example/fp",
      },
    });
  });

  test("omits the auth header when there is no blob", () => {
    const drm = getDrm(
      playSession({
        drmProperties: { laUrl: "https://la.example/wv" },
        drmType: "wvDrm",
      }),
    );

    expect(drm).toEqual({ widevine: { licenseUrl: "https://la.example/wv" } });
  });

  test("returns undefined when the session has no DRM properties", () => {
    expect(getDrm(playSession({ drmType: "none" }))).toBeUndefined();
  });

  test("returns undefined for an unknown DRM type", () => {
    expect(
      getDrm(
        playSession({
          drmProperties: { laUrl: "https://la.example" },
          drmType: "unknown",
        }),
      ),
    ).toBeUndefined();
  });
});
