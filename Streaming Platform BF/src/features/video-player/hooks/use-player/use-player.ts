import type { PlayerStateChange, PlayerTimeUpdate } from "@bfbs/common-sdk";
import { PlaybackPlayerState } from "@bfbs/common-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PlaybackError,
  useBitmovinInstance,
} from "@/features/video-player/hooks/use-bitmovin-instance";
import { usePlaybackErrorHandlers } from "@/features/video-player/hooks/use-playback-error-handlers";
import { useLivePlaySessionLifecycle } from "@/features/video-player/hooks/use-player/use-live-play-session-lifecycle";
import { useMockLivePlayback } from "@/features/video-player/hooks/use-player/use-mock-live-playback";
import { usePlaySessionPersistence } from "@/features/video-player/hooks/use-player/use-play-session-persistence";
import { reportError } from "@/infra/error";
import { clamp, toProgress } from "@/utils/number";
import type { SeekRequest, VideoPlayerProps } from "../../types";
import {
  isUnsupportedSourceForPlatform,
  sourceToLoadRequest,
} from "../../utils/create-load-request";
import {
  getNativeLivePlayer,
  getProgrammeWindowMs,
  getSourcePlayheadBaseMs,
  hasReliableLiveResumeAnchor,
  isHttpClientError,
  normaliseLivePositionSeconds,
} from "../../utils/live-player";
import { mapPlaybackErrorToCode } from "../../utils/playback-error-code";
import { isPlayingState } from "../../utils/player-timing";

export function usePlayer({
  visible,
  source,
}: Pick<VideoPlayerProps, "visible" | "source">) {
  const { initError, instance } = useBitmovinInstance();
  const [error, setError] = useState<PlaybackError | null>(null);
  const [hasReliableLivePositionAnchor, setHasReliableLivePositionAnchor] =
    useState(false);
  const [isUserBehindLive, setIsUserBehindLive] = useState(false);
  const [playerState, setPlayerState] = useState<PlaybackPlayerState>(
    PlaybackPlayerState.IDLE,
  );
  const [playheadSeconds, setPlayheadSeconds] = useState<number | null>(null);

  const [loadAttempt, setLoadAttempt] = useState(0);

  const playheadSecondsRef = useRef<number | null>(null);
  const loadSequenceRef = useRef(0);

  // Mock, remove later
  const isMockLivePlayer = source?.isMockLivePlayer === true;
  const hasSource = source != null;
  const mockStartPositionSeconds =
    isMockLivePlayer && typeof source?.startPositionSeconds === "number"
      ? source.startPositionSeconds
      : null;
  const mockCaptureStartTime = isMockLivePlayer
    ? (source?.playSession?.captureStartTime ?? null)
    : null;
  const { mockPlayheadSeconds, setMockPlayheadPosition } = useMockLivePlayback({
    isMockLivePlayer,
    mockCaptureStartTime,
    mockStartPositionSeconds,
    playerState,
    setPlayerState,
    visible,
  });

  const sourceLoadKey = [
    loadAttempt,
    source?.playSession?.id,
    source?.sourceType,
    source?.startPositionSeconds,
    source?.url,
  ].join("|");
  const sourceProgrammeKey = [
    source?.programme?.endsAt,
    source?.programme?.id,
    source?.programme?.startsAt,
  ].join("|");
  const sourceProgramme = source?.programme ?? null;
  const setTrackedPlayheadSeconds = useCallback((seconds: number | null) => {
    playheadSecondsRef.current = seconds;
    setPlayheadSeconds(seconds);
  }, []);
  const setNormalisedPlayheadSeconds = (nextPositionSeconds: number) => {
    const normalisedPositionSeconds = isMockLivePlayer
      ? nextPositionSeconds
      : normaliseLivePositionSeconds({
          baseMs: getSourcePlayheadBaseMs(source),
          positionSeconds: nextPositionSeconds,
        });

    setTrackedPlayheadSeconds(normalisedPositionSeconds);
  };

  const livePlaySession =
    !isMockLivePlayer && source?.channelId ? source.playSession : null;
  const isTerminal =
    playerState === PlaybackPlayerState.ENDED ||
    playerState === PlaybackPlayerState.ERROR;

  useLivePlaySessionLifecycle({
    isTerminal,
    playSession: livePlaySession ?? null,
    visible,
  });

  usePlaySessionPersistence({ playheadSecondsRef, source, visible });

  useEffect(() => {
    if (!(instance && visible && sourceLoadKey)) {
      return;
    }

    const sequence = loadSequenceRef.current;
    const isStale = () => sequence !== loadSequenceRef.current;

    const load = async () => {
      if (!source) {
        return;
      }

      try {
        setError(null);
        setHasReliableLivePositionAnchor(false);
        setIsUserBehindLive(false);
        setPlayerState(PlaybackPlayerState.IDLE);
        setTrackedPlayheadSeconds(null);

        if (isUnsupportedSourceForPlatform(source.sourceType)) {
          reportError(new Error("Unsupported DASH stream on iOS"));
          setError({ kind: "load" });
          setPlayerState(PlaybackPlayerState.ERROR);
          return;
        }

        await instance.player.load(sourceToLoadRequest(source));

        if (isStale()) {
          return;
        }
      } catch (err) {
        if (isStale()) {
          return;
        }

        if (!isHttpClientError(err)) {
          reportError(err);
        }

        setError({ kind: "load" });
        setPlayerState(PlaybackPlayerState.ERROR);
      }
    };

    const frame = requestAnimationFrame(load);

    return () => {
      loadSequenceRef.current += 1;
      cancelAnimationFrame(frame);
    };
  }, [instance, setTrackedPlayheadSeconds, source, sourceLoadKey, visible]);

  const retry = useCallback(() => {
    setError(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    if (visible && hasSource) {
      if (sourceProgrammeKey) {
        setHasReliableLivePositionAnchor(false);
        setIsUserBehindLive(false);
        setTrackedPlayheadSeconds(null);
      }
      return;
    }

    instance?.player.pause();
    setPlayerState(PlaybackPlayerState.IDLE);
    setHasReliableLivePositionAnchor(false);
    setIsUserBehindLive(false);
    setTrackedPlayheadSeconds(null);
  }, [
    hasSource,
    instance,
    setTrackedPlayheadSeconds,
    sourceProgrammeKey,
    visible,
  ]);

  const seekToProgress = ({ progress }: SeekRequest) => {
    const programmeWindow = getProgrammeWindowMs(sourceProgramme);

    if (!programmeWindow) {
      return;
    }

    const liveEdgeMs = clamp({
      max: programmeWindow.endMs,
      min: programmeWindow.startMs,
      value: Date.now(),
    });
    const liveEdgeProgress = toProgress(
      (liveEdgeMs - programmeWindow.startMs) / programmeWindow.durationMs,
    );
    const targetProgress = clamp({
      max: liveEdgeProgress,
      min: 0,
      value: progress,
    });
    setIsUserBehindLive(targetProgress < liveEdgeProgress);

    if (isMockLivePlayer) {
      const targetSeconds =
        (programmeWindow.durationMs * targetProgress) / 1000;
      setMockPlayheadPosition(targetSeconds);
      return;
    }

    const player = instance?.player;

    if (!player) {
      return;
    }

    const targetMs =
      programmeWindow.startMs + programmeWindow.durationMs * targetProgress;
    const nextPlayheadBaseMs = getSourcePlayheadBaseMs(source);
    const nextPlayheadSeconds =
      nextPlayheadBaseMs === null
        ? null
        : Math.max((targetMs - nextPlayheadBaseMs) / 1000, 0);
    const nativeLivePlayer = getNativeLivePlayer(player);
    const targetTimestampSeconds = Math.floor(targetMs / 1000);

    try {
      if (nativeLivePlayer) {
        nativeLivePlayer.timeShift(
          targetProgress >= liveEdgeProgress ? 0 : targetTimestampSeconds,
        );
      } else {
        void player.seek(Math.max(nextPlayheadSeconds ?? 0, 0));
      }

      setTrackedPlayheadSeconds(nextPlayheadSeconds);
    } catch (seekError) {
      reportError(seekError);
    }
  };

  const togglePlayback = () => {
    const shouldPlay = !isPlayingState(playerState);

    if (isMockLivePlayer) {
      setPlayerState(
        shouldPlay ? PlaybackPlayerState.PLAYING : PlaybackPlayerState.PAUSED,
      );
      return;
    }

    const player = instance?.player;

    if (!player) {
      return;
    }

    setPlayerState(
      shouldPlay ? PlaybackPlayerState.PLAYING : PlaybackPlayerState.PAUSED,
    );

    const playbackAction = shouldPlay ? player.play() : player.pause();

    void Promise.resolve(playbackAction).catch((playbackError) => {
      reportError(playbackError);
    });
  };

  const applyLivePlayhead = (rawPositionSeconds: number) => {
    setHasReliableLivePositionAnchor(
      hasReliableLiveResumeAnchor({ rawPositionSeconds, source }),
    );
    setNormalisedPlayheadSeconds(rawPositionSeconds);
  };

  const handleStateChange = (change: PlayerStateChange) => {
    setPlayerState(change.state);

    if (change.state === PlaybackPlayerState.ERROR) {
      setError((currentError) => currentError ?? { kind: "playback" });
    }

    if (isMockLivePlayer) {
      return;
    }

    if (typeof change.positionSeconds === "number") {
      applyLivePlayhead(change.positionSeconds);
    }
  };

  const handleTimeUpdate = (update: PlayerTimeUpdate) => {
    if (isMockLivePlayer) {
      return;
    }

    applyLivePlayhead(update.positionSeconds);
  };

  const { handlePlayerError, handleSourceError } = usePlaybackErrorHandlers(
    setError,
    setPlayerState,
    source?.playSession,
  );

  const errorCause = error?.cause;
  const errorCode: string | null =
    error || initError
      ? mapPlaybackErrorToCode({
          playSession: source?.playSession,
          playSessionError: errorCause?.playSessionError,
          playerPlaybackError: errorCause?.playerPlaybackError,
        })
      : null;

  const PlayerView = instance?.PlayerView;
  return {
    PlayerView,
    errorCode,
    handlePlayerError,
    handleSourceError,
    handleStateChange,
    handleTimeUpdate,
    hasReliableLivePositionAnchor,
    isUserBehindLive,
    playheadSeconds: mockPlayheadSeconds ?? playheadSeconds,
    playerState,
    retry,
    seekToProgress,
    togglePlayback,
  };
}
