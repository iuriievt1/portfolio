import {
  type Channel,
  PlaybackSourceType,
  type PlaySessionData,
} from "@bfbs/common-sdk";
import type { LiveProgramme, VideoSource } from "../types";

const MOCK_LIVE_CHANNEL_ID = "bfbs-live-mock";
const MOCK_BEHIND_LIVE_CHANNEL_ID = "bfbs-behind-live-mock";
const MOCK_PROGRAMME_DURATION_MS = 90 * 60 * 1000;
const MOCK_PROGRAMME_OFFSET_MS = 35 * 60 * 1000;
const MOCK_BEHIND_LIVE_PLAYHEAD_SECONDS = 30 * 60;
const MOCK_STREAM_URL =
  "https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8";
// Mock, remove later
const MOCK_PLAYBACK_ERROR_URL = "https://stream.mux.com/nonexistent.m3u8";

type MockLiveVideoSourceOptions = {
  programme?: LiveProgramme | null;
  title?: string;
};

function createMockProgramme(nowMs = Date.now()): LiveProgramme {
  const startsAtMs = nowMs - MOCK_PROGRAMME_OFFSET_MS;
  const endsAtMs = startsAtMs + MOCK_PROGRAMME_DURATION_MS;

  return {
    endsAt: new Date(endsAtMs).toISOString(),
    id: "mock-hidden-assets",
    startsAt: new Date(startsAtMs).toISOString(),
    title: "Hidden Assets",
  };
}

/** Builds a mock live playback source while preserving real schedule metadata when available. */
export function createMockLiveVideoSource(
  channel: Channel,
  options: MockLiveVideoSourceOptions = {},
): VideoSource {
  const fallbackProgramme = createMockProgramme();
  const programme = options.programme ?? null;
  const isBehindLiveMock = channel.id === MOCK_BEHIND_LIVE_CHANNEL_ID;
  const captureStartTime = programme?.startsAt ?? fallbackProgramme.startsAt;
  const playSession: PlaySessionData = {
    captureStartTime,
    channelId: channel.id,
    close: async () => {},
    id: "mock-live-play-session",
    manifestUrl: MOCK_STREAM_URL,
    playUrl: {
      href: MOCK_STREAM_URL,
    },
    startKeepAlive: () => {},
    stopKeepAlive: () => {},
  };

  return {
    channelId: channel.id,
    channelTitle: channel.name,
    isMockLivePlayer: true,
    playSession,
    sourceType: PlaybackSourceType.HLS,
    title: options.title ?? programme?.title ?? channel.name,
    url: MOCK_STREAM_URL,
    ...(programme ? { programme } : {}),
    ...(isBehindLiveMock
      ? { startPositionSeconds: MOCK_BEHIND_LIVE_PLAYHEAD_SECONDS }
      : {}),
  };
}

// Mock, remove later
export function createMockPlaybackErrorSource(): VideoSource {
  return {
    sourceType: PlaybackSourceType.HLS,
    title: "Playback error",
    url: MOCK_PLAYBACK_ERROR_URL,
  };
}

export function isMockLiveChannel(channelId: string) {
  return [MOCK_BEHIND_LIVE_CHANNEL_ID, MOCK_LIVE_CHANNEL_ID].includes(
    channelId,
  );
}

export function shouldUseLivePlayerMocks() {
  return process.env.EXPO_PUBLIC_LIVE_PLAYER_USE_MOCKS === "true";
}
