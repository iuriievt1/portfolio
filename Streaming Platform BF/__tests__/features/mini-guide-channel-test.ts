import type { LiveChannel } from "@/features/live-channels";
import { toMiniGuideChannel } from "@/features/mini-guide/utils/to-mini-guide-channel";

function makeChannel(overrides: Partial<LiveChannel> = {}): LiveChannel {
  return {
    id: "channel-1",
    name: "WDR",
    ...overrides,
  };
}

describe("toMiniGuideChannel", () => {
  test("maps now/next metadata, channel logo and programme image", () => {
    const channel = makeChannel({
      media: [{ mimeType: "image/png", type: "logo", url: "logo.png" }],
      currentProgramme: {
        description: "A quiz with a difference.",
        expirationDateTime: "2026-06-08T10:00:00.000Z",
        id: "now-1",
        media: [{ mimeType: "image/jpeg", url: "now.jpg" }],
        startDateTime: "2026-06-08T09:00:00.000Z",
        title: "The Chase",
      },
      nextProgramme: {
        expirationDateTime: "2026-06-08T11:00:00.000Z",
        id: "next-1",
        startDateTime: "2026-06-08T10:00:00.000Z",
        title: "Emmerdale",
      },
    });

    expect(toMiniGuideChannel(channel)).toEqual({
      id: "channel-1",
      logoUrl: "logo.png",
      name: "WDR",
      next: {
        description: undefined,
        endsAt: "2026-06-08T11:00:00.000Z",
        imageUrl: undefined,
        startsAt: "2026-06-08T10:00:00.000Z",
        title: "Emmerdale",
      },
      now: {
        description: "A quiz with a difference.",
        endsAt: "2026-06-08T10:00:00.000Z",
        imageUrl: "now.jpg",
        startsAt: "2026-06-08T09:00:00.000Z",
        title: "The Chase",
      },
    });
  });

  test("prioritizes logo-like channel media and rewrites insecure image urls", () => {
    const channel = makeChannel({
      currentProgramme: {
        expirationDateTime: "2026-06-08T10:00:00.000Z",
        id: "now-1",
        media: [
          { mimeType: "image/jpeg", url: "http://images.example/now.jpg" },
        ],
        startDateTime: "2026-06-08T09:00:00.000Z",
        title: "The Chase",
      },
      media: [
        {
          mimeType: "image/jpeg",
          type: "thumbnail",
          url: "http://images.example/channel-thumbnail.jpg",
        },
        {
          mimeType: "image/png",
          type: "logo",
          url: "http://images.example/channel-logo.png",
        },
      ],
    });

    const result = toMiniGuideChannel(channel);

    expect(result.logoUrl).toBe("https://images.example/channel-logo.png");
    expect(result.now?.imageUrl).toBe("https://images.example/now.jpg");
  });

  test("falls back to the first usable channel image when no logo media exists", () => {
    const channel = makeChannel({
      media: [
        {
          mimeType: "image/jpeg",
          type: "thumbnail",
          url: "https://images.example/channel-thumbnail.jpg",
        },
      ],
    });

    expect(toMiniGuideChannel(channel).logoUrl).toBe(
      "https://images.example/channel-thumbnail.jpg",
    );
  });

  test("leaves logo undefined when the channel has no media", () => {
    const channel = makeChannel();

    expect(toMiniGuideChannel(channel).logoUrl).toBeUndefined();
  });

  test("returns null now/next when programme metadata is missing", () => {
    const channel = makeChannel({
      currentProgramme: {
        id: "now-1",
        title: "No schedule yet",
      },
    });

    const result = toMiniGuideChannel(channel);

    expect(result.now).toBeNull();
    expect(result.next).toBeNull();
  });

  test("falls back to synopsis for the description", () => {
    const channel = makeChannel({
      currentProgramme: {
        id: "now-1",
        startDateTime: "2026-06-08T09:00:00.000Z",
        synopsis: "Synopsis fallback",
        title: "The Chase",
      },
    });

    expect(toMiniGuideChannel(channel).now?.description).toBe(
      "Synopsis fallback",
    );
  });

  test("derives the programme end from the duration when no expiry is given", () => {
    const channel = makeChannel({
      currentProgramme: {
        durationSeconds: 1800,
        id: "now-1",
        startDateTime: "2026-06-08T09:00:00.000Z",
        title: "The Chase",
      },
    });

    expect(toMiniGuideChannel(channel).now?.endsAt).toBe(
      "2026-06-08T09:30:00.000Z",
    );
  });
});
