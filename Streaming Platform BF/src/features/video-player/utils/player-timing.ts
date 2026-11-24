import { PlaybackPlayerState } from "@bfbs/common-sdk";
import { parseDateMs } from "@/utils/date-time";
import { clamp, toProgress } from "@/utils/number";
import type { LiveProgramme, VideoSource } from "../types";

export const LIVE_EDGE_TOLERANCE_MS = 10_000;

/** Whether the player state counts as playing, including ready and buffering. */
export function isPlayingState(state: PlaybackPlayerState) {
  return (
    state === PlaybackPlayerState.PLAYING ||
    state === PlaybackPlayerState.BUFFERING ||
    state === PlaybackPlayerState.READY
  );
}

export type LivePlayerTiming = {
  durationMs: number;
  hasReliableLiveEdgeAnchor: boolean;
  isBehindLive: boolean;
  liveEdgeMs: number;
  liveEdgeProgress: number;
  measuredLiveGapMs: number;
  measuredPlayheadMs: number;
  playheadMs: number;
  playheadProgress: number;
};

type TimingInput = {
  hasReliablePlayheadAnchor?: boolean | undefined;
  hasLostLiveSync?: boolean | undefined;
  isUserBehindLive?: boolean | undefined;
  nowMs: number;
  playheadSeconds: number | null;
  programme: LiveProgramme;
  source?:
    | Pick<VideoSource, "playSession" | "startPositionSeconds">
    | undefined;
};

/** Measures how much a live playhead has drifted behind device-clock progress. */
export function getLiveSyncDriftMs({
  anchorPlayheadMs,
  anchorWallMs,
  nowMs,
  playheadMs,
}: {
  anchorPlayheadMs: number;
  anchorWallMs: number;
  nowMs: number;
  playheadMs: number;
}) {
  const elapsedWallMs = nowMs - anchorWallMs;
  const elapsedPlayheadMs = playheadMs - anchorPlayheadMs;

  return Math.max(elapsedWallMs - elapsedPlayheadMs, 0);
}

function getPlayheadBaseMs({
  programmeStartMs,
  source,
}: {
  programmeStartMs: number;
  source?: TimingInput["source"];
}) {
  return (
    parseDateMs(source?.playSession?.playbackStartTime) ??
    parseDateMs(source?.playSession?.captureStartTime) ??
    programmeStartMs
  );
}

const EPOCH_SECONDS_THRESHOLD = 1_000_000_000;

function hasReliableLiveEdgeAnchor({
  hasReliablePlayheadAnchor,
  playheadSeconds,
  source,
}: {
  hasReliablePlayheadAnchor?: boolean | undefined;
  playheadSeconds: number | null;
  source?: TimingInput["source"];
}) {
  if (hasReliablePlayheadAnchor) {
    return true;
  }

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

  if (playheadSeconds !== null && playheadSeconds >= EPOCH_SECONDS_THRESHOLD) {
    return true;
  }

  return false;
}

function getResolvedPlayheadMs({
  baseMs,
  liveEdgeMs,
  playheadSeconds,
  sourceStartPositionMs,
}: {
  baseMs: number;
  liveEdgeMs: number;
  playheadSeconds: number | null;
  sourceStartPositionMs?: number | undefined;
}) {
  if (playheadSeconds !== null) {
    return baseMs + playheadSeconds * 1000;
  }

  if (sourceStartPositionMs !== undefined) {
    return baseMs + sourceStartPositionMs;
  }

  return liveEdgeMs;
}

/** Resolves what the live overlay shows: elapsed, progress, and live-edge state. */
export function getLivePlayerTiming({
  hasReliablePlayheadAnchor = false,
  hasLostLiveSync = false,
  isUserBehindLive = false,
  nowMs,
  playheadSeconds,
  programme,
  source,
}: TimingInput): LivePlayerTiming {
  const programmeStartMs = parseDateMs(programme.startsAt) ?? nowMs;
  const programmeEndMs = parseDateMs(programme.endsAt) ?? programmeStartMs + 1;
  const durationMs = Math.max(programmeEndMs - programmeStartMs, 1);
  const liveEdgeMs = clamp({
    max: programmeEndMs,
    min: programmeStartMs,
    value: nowMs,
  });
  const baseMs = getPlayheadBaseMs({ programmeStartMs, source });
  const sourceStartPositionMs =
    typeof source?.startPositionSeconds === "number"
      ? source.startPositionSeconds * 1000
      : undefined;
  const resolvedPlayheadMs = getResolvedPlayheadMs({
    baseMs,
    liveEdgeMs,
    playheadSeconds,
    sourceStartPositionMs,
  });
  const hasReliableAnchor = hasReliableLiveEdgeAnchor({
    hasReliablePlayheadAnchor,
    playheadSeconds,
    source,
  });
  const measuredPlayheadMs = clamp({
    max: liveEdgeMs,
    min: programmeStartMs,
    value: resolvedPlayheadMs,
  });
  const measuredLiveGapMs = liveEdgeMs - measuredPlayheadMs;
  const liveEdgeProgress = toProgress(
    (liveEdgeMs - programmeStartMs) / durationMs,
  );
  const measuredPlayheadProgress = toProgress(
    (measuredPlayheadMs - programmeStartMs) / durationMs,
  );
  const shouldSnapToLiveEdge = !(isUserBehindLive || hasLostLiveSync);
  const playheadMs = shouldSnapToLiveEdge ? liveEdgeMs : measuredPlayheadMs;
  const playheadProgress = shouldSnapToLiveEdge
    ? liveEdgeProgress
    : measuredPlayheadProgress;

  return {
    durationMs,
    hasReliableLiveEdgeAnchor: hasReliableAnchor,
    isBehindLive: isUserBehindLive || hasLostLiveSync,
    liveEdgeMs,
    liveEdgeProgress,
    measuredLiveGapMs,
    measuredPlayheadMs,
    playheadMs,
    playheadProgress,
  };
}

/** Converts a scrub position into the wall-clock time inside the programme. */
export function getProgrammeTimeAtProgress({
  programme,
  progress,
}: {
  programme: LiveProgramme;
  progress: number;
}) {
  const programmeStartMs = parseDateMs(programme.startsAt) ?? 0;
  const programmeEndMs = parseDateMs(programme.endsAt) ?? programmeStartMs;
  const durationMs = Math.max(programmeEndMs - programmeStartMs, 1);

  return programmeStartMs + durationMs * toProgress(progress);
}
