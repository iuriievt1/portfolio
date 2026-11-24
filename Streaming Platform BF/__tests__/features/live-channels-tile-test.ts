import { toLiveTile } from "@/features/live-channels/to-live-tile";
import type { LiveChannel } from "@/features/live-channels/types";

/**
 * The time label is produced in the device's local timezone, so these fixtures
 * are built from local-time components rather than fixed UTC strings. That
 * keeps the expected label correct on any host machine.
 */
const PROGRAMME_START = new Date(2026, 6, 20, 14, 0);

function buildChannel(overrides: Partial<LiveChannel> = {}): LiveChannel {
  return {
    currentProgramme: {
      durationSeconds: 3600,
      id: "programme-1",
      media: [{ mimeType: "image/jpeg", url: "https://images.test/prog.jpg" }],
      startDateTime: PROGRAMME_START.toISOString(),
      title: "Liverpool vs PSG",
    },
    id: "channel-1",
    media: [
      {
        mimeType: "image/png",
        type: "logo",
        url: "https://images.test/logo.png",
      },
    ],
    name: "BBC One",
    ...overrides,
  };
}

const CHANNEL_MEDIA = [
  {
    mimeType: "image/png",
    type: "logo",
    url: "https://images.test/logo.png",
  },
];

describe("toLiveTile", () => {
  test("maps a channel with a current programme", () => {
    expect(toLiveTile(buildChannel())).toEqual({
      channelMedia: CHANNEL_MEDIA,
      channelName: "BBC One",
      contentType: "live",
      id: "channel-1",
      media: [{ mimeType: "image/jpeg", url: "https://images.test/prog.jpg" }],
      progressEndMs: PROGRAMME_START.getTime() + 60 * 60 * 1000,
      progressStartMs: PROGRAMME_START.getTime(),
      timeLabel: "14:00 - 15:00",
      title: "Liverpool vs PSG",
    });
  });

  test("falls back to the channel name and omits time and progress", () => {
    const channel = buildChannel();
    delete channel.currentProgramme;

    expect(toLiveTile(channel)).toEqual({
      channelMedia: CHANNEL_MEDIA,
      channelName: "BBC One",
      contentType: "live",
      id: "channel-1",
      title: "BBC One",
    });
  });

  test("omits media when the programme has no artwork", () => {
    const channel = buildChannel();
    delete channel.currentProgramme?.media;

    expect(toLiveTile(channel)).not.toHaveProperty("media");
  });
});
