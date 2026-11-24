import type { PlayerInstance } from "@bfbs/common-sdk";
import { SynamediaGoApiError } from "@bfbs/common-sdk";
import type { ReactElement } from "react";
import { parseDateMs } from "@/utils/date-time";
import type { VideoPlayerProps } from "../types";

const EPOCH_MS_THRESHOLD = 1_000_000_000_000;
const EPOCH_SECONDS_THRESHOLD = 1_000_000_000;

type PlayerProgramme = NonNullable<VideoPlayerProps["source"]>["programme"];
type NativeLivePlayer = {
  timeShift: (offsetSeconds: number) => void;
};
type PlayerWithNativeLiveApi = PlayerInstance<ReactElement>["player"] & {
  bitmovinPlayer?: NativeLivePlayer;
};

export function isHttpClientError(error: unknown) {
  return (
    error instanceof SynamediaGoApiError &&
    error.status >= 400 &&
    error.status < 500
  );
}

export function getProgrammeWindowMs(
  programme: PlayerProgramme | null | undefined,
) {
  if (!programme) {
    return null;
  }

  const startMs = parseDateMs(programme.startsAt);
  const endMs = parseDateMs(programme.endsAt);

  if (startMs === null || endMs === null) {
    return null;
  }

  return {
    durationMs: Math.max(endMs - startMs, 1),
    endMs,
    startMs,
  };
}

export function getSourcePlayheadBaseMs(source: VideoPlayerProps["source"]) {
  return (
    parseDateMs(source?.playSession?.playbackStartTime) ??
    parseDateMs(source?.playSession?.captureStartTime) ??
    parseDateMs(source?.programme?.startsAt)
  );
}

export function normaliseLivePositionSeconds({
  baseMs,
  positionSeconds,
}: {
  baseMs: number | null;
  positionSeconds: number;
}) {
  if (baseMs === null) {
    return positionSeconds;
  }

  if (positionSeconds >= EPOCH_MS_THRESHOLD) {
    return Math.max((positionSeconds - baseMs) / 1000, 0);
  }

  if (positionSeconds >= EPOCH_SECONDS_THRESHOLD) {
    return Math.max((positionSeconds * 1000 - baseMs) / 1000, 0);
  }

  return positionSeconds;
}

export function getNativeLivePlayer(
  player: PlayerInstance<ReactElement>["player"] | null | undefined,
) {
  const candidate = player as PlayerWithNativeLiveApi | null | undefined;

  if (typeof candidate?.bitmovinPlayer?.timeShift !== "function") {
    return null;
  }

  return candidate.bitmovinPlayer;
}

export function hasReliableLiveResumeAnchor({
  rawPositionSeconds,
  source,
}: {
  rawPositionSeconds: number | null;
  source: VideoPlayerProps["source"];
}) {
  if (parseDateMs(source?.playSession?.playbackStartTime) !== null) {
    return true;
  }

  if (parseDateMs(source?.playSession?.captureStartTime) !== null) {
    return true;
  }

  if (
    typeof source?.startPositionSeconds === "number" &&
    source.startPositionSeconds > 0
  ) {
    return true;
  }

  if (
    rawPositionSeconds !== null &&
    rawPositionSeconds >= EPOCH_SECONDS_THRESHOLD
  ) {
    return true;
  }

  return false;
}

export function isLiveSource(
  source: { channelId?: string } | null | undefined,
) {
  return Boolean(source?.channelId);
}
