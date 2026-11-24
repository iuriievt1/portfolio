import { PlaybackPlayerState } from "@bfbs/common-sdk";
import { useEffect, useRef, useState } from "react";
import {
  NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS,
  shouldRefreshAtBoundary,
} from "@/features/live-channels/now-and-next-refresh";
import { usePlayer } from "@/features/video-player/hooks/use-player/use-player";
import { usePlayerChrome } from "@/features/video-player/hooks/use-player-chrome/use-player-chrome";
import {
  getLivePlayerTiming,
  getLiveSyncDriftMs,
  LIVE_EDGE_TOLERANCE_MS,
} from "@/features/video-player/utils/player-timing";
import { useCurrentTime } from "@/hooks/use-current-time";
import { parseDateMs } from "@/utils/date-time";
import type { VideoPlayerProps } from "../types";

type UseVideoPlayerParams = {
  onProgrammeBoundary: VideoPlayerProps["onProgrammeBoundary"];
  source: VideoPlayerProps["source"];
  visible: VideoPlayerProps["visible"];
};

export function useVideoPlayer({
  onProgrammeBoundary,
  source,
  visible,
}: UseVideoPlayerParams) {
  const {
    controlsOpacity,
    markInteraction,
    overlayLayout,
    shouldRenderControls,
    toggleControlsFromBodyPress,
  } = usePlayerChrome(visible);

  const [isMiniGuideOpen, setIsMiniGuideOpen] = useState(false);

  const liveSyncAnchorRef = useRef<{
    playheadMs: number;
    wallMs: number;
  } | null>(null);
  const liveSyncChannelIdRef = useRef<string | undefined>(undefined);
  const lastBoundaryRefreshRef = useRef<{
    programmeRefreshKey: string | null;
    refreshedAtMs: number;
  } | null>(null);
  const wasMetadataFrozenRef = useRef(false);

  const {
    PlayerView,
    errorCode,
    handlePlayerError,
    handleSourceError,
    handleStateChange,
    handleTimeUpdate,
    hasReliableLivePositionAnchor,
    isUserBehindLive,
    playerState,
    playheadSeconds,
    retry,
    seekToProgress,
    togglePlayback,
  } = usePlayer({
    visible,
    source,
  });
  const programme = source?.programme ?? null;
  const timingNowMs = useCurrentTime(visible && programme !== null);
  const baseTiming = programme
    ? getLivePlayerTiming({
        hasReliablePlayheadAnchor: hasReliableLivePositionAnchor,
        isUserBehindLive,
        nowMs: timingNowMs,
        playheadSeconds,
        programme,
        source,
      })
    : null;
  const liveSyncDriftMs =
    liveSyncAnchorRef.current && baseTiming?.hasReliableLiveEdgeAnchor
      ? getLiveSyncDriftMs({
          anchorPlayheadMs: liveSyncAnchorRef.current.playheadMs,
          anchorWallMs: liveSyncAnchorRef.current.wallMs,
          nowMs: timingNowMs,
          playheadMs: baseTiming.measuredPlayheadMs,
        })
      : 0;
  const hasExplicitBehindLiveStart = Boolean(
    source?.channelId &&
      typeof source.startPositionSeconds === "number" &&
      baseTiming?.hasReliableLiveEdgeAnchor &&
      baseTiming.measuredLiveGapMs > LIVE_EDGE_TOLERANCE_MS,
  );
  const hasLostLiveSync =
    hasExplicitBehindLiveStart || liveSyncDriftMs > LIVE_EDGE_TOLERANCE_MS;
  const timing = programme
    ? getLivePlayerTiming({
        hasLostLiveSync,
        hasReliablePlayheadAnchor: hasReliableLivePositionAnchor,
        isUserBehindLive,
        nowMs: timingNowMs,
        playheadSeconds,
        programme,
        source,
      })
    : null;
  const isBehindLive = timing?.isBehindLive ?? false;
  const isMetadataFrozen =
    playerState === PlaybackPlayerState.PAUSED || isBehindLive;
  const programmeBoundaryMs = programme ? parseDateMs(programme.endsAt) : null;
  const programmeRefreshKey = programme
    ? [programme.endsAt, programme.id, programme.startsAt].join("|")
    : null;

  useEffect(() => {
    const liveChannelId = visible ? source?.channelId : undefined;

    if (liveSyncChannelIdRef.current !== liveChannelId) {
      liveSyncChannelIdRef.current = liveChannelId;
      liveSyncAnchorRef.current = null;
    }

    if (
      !(liveChannelId && baseTiming?.hasReliableLiveEdgeAnchor) ||
      isUserBehindLive
    ) {
      liveSyncAnchorRef.current = null;
      return;
    }

    if (liveSyncAnchorRef.current !== null) {
      return;
    }

    liveSyncAnchorRef.current = {
      playheadMs: baseTiming.measuredPlayheadMs,
      wallMs: timingNowMs,
    };
  }, [
    baseTiming?.hasReliableLiveEdgeAnchor,
    baseTiming?.measuredPlayheadMs,
    isUserBehindLive,
    source?.channelId,
    timingNowMs,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      setIsMiniGuideOpen(false);
    }
  }, [visible]);

  useEffect(() => {
    const didResumeLiveMetadata =
      wasMetadataFrozenRef.current && !isMetadataFrozen;

    if (
      didResumeLiveMetadata &&
      visible &&
      onProgrammeBoundary &&
      shouldRefreshAtBoundary(programmeBoundaryMs)
    ) {
      onProgrammeBoundary();
    }

    wasMetadataFrozenRef.current = isMetadataFrozen;
  }, [isMetadataFrozen, onProgrammeBoundary, programmeBoundaryMs, visible]);

  useEffect(() => {
    if (!(visible && programmeRefreshKey && onProgrammeBoundary)) {
      return;
    }

    if (isMetadataFrozen) {
      return;
    }

    if (!shouldRefreshAtBoundary(programmeBoundaryMs, timingNowMs)) {
      return;
    }

    const lastBoundaryRefresh = lastBoundaryRefreshRef.current;

    if (
      lastBoundaryRefresh?.programmeRefreshKey === programmeRefreshKey &&
      timingNowMs - lastBoundaryRefresh.refreshedAtMs <
        NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    lastBoundaryRefreshRef.current = {
      programmeRefreshKey,
      refreshedAtMs: timingNowMs,
    };
    onProgrammeBoundary();
  }, [
    isMetadataFrozen,
    onProgrammeBoundary,
    programmeBoundaryMs,
    programmeRefreshKey,
    timingNowMs,
    visible,
  ]);

  return {
    PlayerView,
    controlsOpacity,
    errorCode,
    handlePlayerError,
    handleSourceError,
    handleStateChange,
    handleTimeUpdate,
    isMiniGuideOpen,
    isBehindLive,
    markInteraction,
    overlayLayout,
    playerState,
    retry,
    timing,
    seekToProgress,
    setIsMiniGuideOpen,
    shouldRenderControls,
    togglePlayback,
    toggleControlsFromBodyPress,
  };
}
