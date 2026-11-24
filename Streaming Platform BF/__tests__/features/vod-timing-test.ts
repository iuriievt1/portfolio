import {
  formatVodTime,
  getVodProgress,
} from "@/features/video-player/utils/vod-timing";

jest.mock("@bfbs/common-sdk", () => ({
  PlaybackPlayerState: {
    BUFFERING: "buffering",
    ENDED: "ended",
    ERROR: "error",
    IDLE: "idle",
    LOADING: "loading",
    PAUSED: "paused",
    PLAYING: "playing",
    READY: "ready",
  },
}));

describe("getVodProgress", () => {
  test("returns 0 when the duration is unknown or non-positive", () => {
    expect(getVodProgress({ durationSeconds: null, positionSeconds: 30 })).toBe(
      0,
    );
    expect(getVodProgress({ durationSeconds: 0, positionSeconds: 30 })).toBe(0);
    expect(getVodProgress({ durationSeconds: -10, positionSeconds: 30 })).toBe(
      0,
    );
  });

  test("returns the clamped fraction of the duration", () => {
    expect(getVodProgress({ durationSeconds: 200, positionSeconds: 0 })).toBe(
      0,
    );
    expect(getVodProgress({ durationSeconds: 200, positionSeconds: 50 })).toBe(
      0.25,
    );
    expect(getVodProgress({ durationSeconds: 200, positionSeconds: 200 })).toBe(
      1,
    );
    expect(getVodProgress({ durationSeconds: 200, positionSeconds: 300 })).toBe(
      1,
    );
  });
});

describe("formatVodTime", () => {
  test("formats sub-hour positions as mm:ss", () => {
    expect(formatVodTime(0)).toBe("00:00");
    expect(formatVodTime(65)).toBe("01:05");
    expect(formatVodTime(600)).toBe("10:00");
  });

  test("formats hour-plus positions as hh:mm:ss", () => {
    expect(formatVodTime(3600)).toBe("01:00:00");
    expect(formatVodTime(3725)).toBe("01:02:05");
  });

  test("floors fractional seconds and clamps negatives to zero", () => {
    expect(formatVodTime(65.9)).toBe("01:05");
    expect(formatVodTime(-5)).toBe("00:00");
  });
});
