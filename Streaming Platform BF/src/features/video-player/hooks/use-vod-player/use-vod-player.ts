import type {
  PlayerError,
  PlayerInstance,
  PlayerStateChange,
  PlayerTimeUpdate,
} from "@bfbs/common-sdk";
import { PlaybackPlayerState, PlayerErrorCode } from "@bfbs/common-sdk";
import { type ReactElement, useEffect, useRef, useState } from "react";
import {
  type PlaybackError,
  useBitmovinInstance,
} from "@/features/video-player/hooks/use-bitmovin-instance";
import { usePlaySessionPersistence } from "@/features/video-player/hooks/use-player/use-play-session-persistence";
import { usePlayerChrome } from "@/features/video-player/hooks/use-player-chrome/use-player-chrome";
import type {
  SeekRequest,
  VodVideoSource,
} from "@/features/video-player/types";
import {
  isUnsupportedSourceForPlatform,
  sourceToLoadRequest,
} from "@/features/video-player/utils/create-load-request";
import { mapPlaybackErrorToCode } from "@/features/video-player/utils/playback-error-code";
import { isPlayingState } from "@/features/video-player/utils/player-timing";
import { reportPlaybackError } from "@/features/video-player/utils/report-playback-error";
import { reportError } from "@/infra/error";
import { clamp, toProgress } from "@/utils/number";

const SEEK_SETTLE_TOLERANCE_SECONDS = 1;
const STALL_CHECK_INTERVAL_MS = 2000;
// Temporary cap while investigating continuous buffering on series VOD.
const TEMPORARY_VOD_MAX_SELECTABLE_BITRATE = 2_500_000;

type NativeVodPlayer = {
  getDuration: () => Promise<number> | number;
  setMaxSelectableBitrate?:
    | ((bitrate: number | null) => void | Promise<void>)
    | undefined;
};
type PlayerWithNativeVodApi = PlayerInstance<ReactElement>["player"] & {
  bitmovinPlayer?: NativeVodPlayer;
};

function getNativeVodDuration(
  player: PlayerInstance<ReactElement>["player"] | null | undefined,
) {
  const candidate = player as PlayerWithNativeVodApi | null | undefined;

  if (typeof candidate?.bitmovinPlayer?.getDuration !== "function") {
    return null;
  }

  return candidate.bitmovinPlayer.getDuration();
}

function setTemporaryVodBitrate(
  player: PlayerInstance<ReactElement>["player"],
) {
  const nativePlayer = player as PlayerWithNativeVodApi;
  const setMaxSelectableBitrate =
    nativePlayer.bitmovinPlayer?.setMaxSelectableBitrate;

  if (typeof setMaxSelectableBitrate !== "function") {
    return;
  }

  try {
    void Promise.resolve(
      setMaxSelectableBitrate.call(
        nativePlayer.bitmovinPlayer,
        TEMPORARY_VOD_MAX_SELECTABLE_BITRATE,
      ),
    ).catch(reportError);
  } catch (error) {
    reportError(error);
  }
}

function toPlaybackError(errorDescription: string): PlayerError {
  return {
    errorCode: PlayerErrorCode.PLAYBACK_FAILED,
    errorDescription,
    position: 0,
    sessionId: "",
  };
}

type UseVodPlayerParams = {
  onEnded: () => void;
  source: VodVideoSource | null;
  visible: boolean;
};

/** Manages VOD player loading, controls, seeking, and playback error state. */
export function useVodPlayer({ onEnded, source, visible }: UseVodPlayerParams) {
  const { initError, instance } = useBitmovinInstance();
  const {
    controlsOpacity,
    markInteraction,
    overlayLayout,
    shouldRenderControls,
    toggleControlsFromBodyPress,
  } = usePlayerChrome(visible);

  const [error, setError] = useState<PlaybackError | null>(null);
  const [playerState, setPlayerState] = useState<PlaybackPlayerState>(
    PlaybackPlayerState.IDLE,
  );
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [probedDurationSeconds, setProbedDurationSeconds] = useState<
    number | null
  >(null);

  const loadSequenceRef = useRef(0);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const durationKnownRef = useRef(false);
  const playheadSecondsRef = useRef<number | null>(null);
  const stallBaselineSecondsRef = useRef<number | null>(null);

  // Prefer the real video length over metadata.
  const rawDurationSeconds =
    probedDurationSeconds ?? source?.durationSeconds ?? null;
  const durationSeconds =
    rawDurationSeconds !== null && rawDurationSeconds > 0
      ? rawDurationSeconds
      : null;

  useEffect(() => {
    durationKnownRef.current = probedDurationSeconds !== null;
  }, [probedDurationSeconds]);

  useEffect(() => {
    playheadSecondsRef.current = positionSeconds;
  }, [positionSeconds]);

  // Bitmovin doesn't reliably fire a stall event when the network drops
  // entirely, so a stuck playhead during PLAYING is the fallback signal.
  useEffect(() => {
    if (playerState !== PlaybackPlayerState.PLAYING) {
      setIsStalled(false);
      return;
    }

    stallBaselineSecondsRef.current = playheadSecondsRef.current;

    const interval = setInterval(() => {
      const currentPositionSeconds = playheadSecondsRef.current;

      setIsStalled(currentPositionSeconds === stallBaselineSecondsRef.current);
      stallBaselineSecondsRef.current = currentPositionSeconds;
    }, STALL_CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [playerState]);

  usePlaySessionPersistence({ playheadSecondsRef, source, visible });

  const applyPlayerPosition = (rawPositionSeconds: number) => {
    if (!Number.isFinite(rawPositionSeconds)) {
      return;
    }

    const nextPositionSeconds = Math.max(rawPositionSeconds, 0);
    const pendingSeekTarget = pendingSeekTargetRef.current;

    if (pendingSeekTarget !== null) {
      if (
        Math.abs(nextPositionSeconds - pendingSeekTarget) <=
        SEEK_SETTLE_TOLERANCE_SECONDS
      ) {
        pendingSeekTargetRef.current = null;
      } else {
        return;
      }
    }

    setPositionSeconds(nextPositionSeconds);
  };

  const probeDurationIfNeeded = () => {
    if (durationKnownRef.current) {
      return;
    }

    const nativeDuration = getNativeVodDuration(instance?.player);

    if (nativeDuration === null) {
      return;
    }

    void Promise.resolve(nativeDuration)
      .then((value) => {
        if (Number.isFinite(value) && value > 0) {
          setProbedDurationSeconds(value);
        }
      })
      .catch(reportError);
  };

  useEffect(() => {
    if (!(instance && visible && source)) {
      return;
    }

    setError(null);
    setHasStartedPlayback(false);
    setPlayerState(PlaybackPlayerState.IDLE);
    setProbedDurationSeconds(null);
    setPositionSeconds(0);
    pendingSeekTargetRef.current = null;

    const sequence = loadSequenceRef.current;
    const isStale = () => sequence !== loadSequenceRef.current;

    const load = async () => {
      try {
        if (isUnsupportedSourceForPlatform(source.sourceType)) {
          const unsupportedError = new Error("Unsupported DASH stream on iOS");
          reportError(unsupportedError);
          setError({
            cause: {
              playerPlaybackError: toPlaybackError(unsupportedError.message),
            },
            kind: "load",
          });
          setPlayerState(PlaybackPlayerState.ERROR);
          return;
        }

        setTemporaryVodBitrate(instance.player);
        await instance.player.load(sourceToLoadRequest(source));

        if (isStale()) {
          return;
        }
      } catch (err) {
        if (isStale()) {
          return;
        }

        reportError(err);
        setError({ cause: { playSessionError: err }, kind: "load" });
      }
    };

    const frame = requestAnimationFrame(load);

    return () => {
      loadSequenceRef.current += 1;
      cancelAnimationFrame(frame);
    };
  }, [instance, source, visible]);

  useEffect(() => {
    if (visible && source) {
      return;
    }

    instance?.player.pause();
  }, [instance, source, visible]);

  const seekToSeconds = (seconds: number) => {
    const player = instance?.player;

    if (!player) {
      return;
    }

    const target =
      durationSeconds === null
        ? Math.max(seconds, 0)
        : clamp({ max: durationSeconds, min: 0, value: seconds });

    pendingSeekTargetRef.current = target;
    setPositionSeconds(target);

    void Promise.resolve(player.seek(target)).catch(reportError);
  };

  const seekToProgress = ({ isFinalSeek = true, progress }: SeekRequest) => {
    if (durationSeconds === null) {
      return;
    }

    if (!isFinalSeek && pendingSeekTargetRef.current !== null) {
      return;
    }

    seekToSeconds(toProgress(progress) * durationSeconds);
  };

  const skipBySeconds = (deltaSeconds: number) => {
    const fromSeconds = pendingSeekTargetRef.current ?? positionSeconds;

    seekToSeconds(fromSeconds + deltaSeconds);
  };

  const togglePlayback = () => {
    const player = instance?.player;

    if (!player) {
      return;
    }

    const shouldPlay = !isPlayingState(playerState);
    setPlayerState(
      shouldPlay ? PlaybackPlayerState.PLAYING : PlaybackPlayerState.PAUSED,
    );

    const playbackAction = shouldPlay ? player.play() : player.pause();

    void Promise.resolve(playbackAction).catch((playbackError) => {
      reportError(playbackError);
    });
  };

  const handleStateChange = (change: PlayerStateChange) => {
    setPlayerState(change.state);

    if (change.state === PlaybackPlayerState.PLAYING) {
      setHasStartedPlayback(true);
    }

    if (change.state === PlaybackPlayerState.ERROR) {
      setError((currentError) => currentError ?? { kind: "playback" });
    }

    if (change.state === PlaybackPlayerState.ENDED) {
      playheadSecondsRef.current = 0;
      onEnded();
    }

    if (
      change.state !== PlaybackPlayerState.IDLE &&
      change.state !== PlaybackPlayerState.ERROR
    ) {
      probeDurationIfNeeded();
    }

    if (typeof change.positionSeconds === "number") {
      applyPlayerPosition(change.positionSeconds);
    }
  };

  const handleTimeUpdate = (update: PlayerTimeUpdate) => {
    applyPlayerPosition(update.positionSeconds);
    probeDurationIfNeeded();
  };

  const handlePlayerError = (playerError: PlayerError) => {
    reportPlaybackError(playerError, {
      playSession: source?.playSession,
      playerPlaybackError: playerError,
    });
    setError({ cause: { playerPlaybackError: playerError }, kind: "playback" });
    setPlayerState(PlaybackPlayerState.ERROR);
  };

  const handleSourceError = (sourceError: unknown) => {
    reportPlaybackError(sourceError, {
      playSession: source?.playSession,
      playSessionError: sourceError,
    });
    // Keep detail the SDK already sent to onError, e.g. Android 2305 as
    // PLAY_005, but replace a placeholder that carries none.
    setError((current) =>
      current?.cause
        ? current
        : { cause: { playSessionError: sourceError }, kind: "load" },
    );
    setPlayerState(PlaybackPlayerState.ERROR);
  };

  const retry = () => {
    const player = instance?.player;

    if (!(player && source)) {
      return;
    }

    const sequence = loadSequenceRef.current;
    const isStale = () => sequence !== loadSequenceRef.current;

    setError(null);
    setHasStartedPlayback(false);
    setPlayerState(PlaybackPlayerState.IDLE);

    void Promise.resolve(player.load(sourceToLoadRequest(source))).catch(
      (err) => {
        if (isStale()) {
          return;
        }

        reportError(err);
        setError({ cause: { playSessionError: err }, kind: "load" });
      },
    );
  };

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
    controlsOpacity,
    durationSeconds,
    errorCode,
    handlePlayerError,
    handleSourceError,
    handleStateChange,
    handleTimeUpdate,
    hasStartedPlayback,
    isStalled,
    markInteraction,
    overlayLayout,
    playerState,
    positionSeconds,
    retry,
    seekToProgress,
    seekToSeconds,
    shouldRenderControls,
    skipBySeconds,
    togglePlayback,
    toggleControlsFromBodyPress,
  };
}
