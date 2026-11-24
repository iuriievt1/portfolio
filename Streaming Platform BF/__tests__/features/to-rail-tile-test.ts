import type { ContentItem } from "@bfbs/common-sdk";

import { toRailTile } from "@/features/content-rails/utils/to-rail-tile";

describe("toRailTile", () => {
  test("maps VOD duration and channel attribution onto the tile", () => {
    const item: ContentItem = {
      channel: { id: "forces-sport", name: "BFBS Forces Sport" },
      contentDurationSeconds: 32,
      contentType: "standalone",
      id: "short",
      title: "Rescue teams put to the test",
    };

    expect(toRailTile(item, "Europe/London")).toMatchObject({
      channelName: "BFBS Forces Sport",
      contentType: "vod",
      durationSeconds: 32,
      id: "short",
      title: "Rescue teams put to the test",
    });
  });

  test("formats live programme times in the listing timezone", () => {
    const item: ContentItem = {
      channelId: "channel-1",
      contentType: "episode",
      durationSeconds: 3600,
      id: "programme-1",
      startDateTime: "2026-06-10T13:00:00.000Z",
      title: "Live programme",
    };

    expect(toRailTile(item, "Europe/London")).toMatchObject({
      contentType: "live",
      timeLabel: "14:00 - 15:00",
    });
  });
});
