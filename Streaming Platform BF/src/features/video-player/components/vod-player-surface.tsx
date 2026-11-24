import { PlaybackPlayerState } from "@bfbs/common-sdk";
import { useRef } from "react";
import { Animated } from "react-native";
import { PlayerStage } from "@/features/video-player/components/player-stage";
import { VodPlayerOverlay } from "@/features/video-player/components/vod-player-overlay";
import type { useVodPlayer } from "@/features/video-player/hooks/use-vod-player/use-vod-player";
import type { VodVideoSource } from "@/features/video-player/types";
import { mapPlaybackErrorToCode } from "@/features/video-player/utils/playback-error-code";
import { ErrorModal, useErrorAction } from "@/infra/error";

const SKIP_SECONDS = 10;
const INITIAL_LOADING_DELAY_MS = 3000;

type VodPlayerSurfaceProps = {
  isLoading?: boolean | undefined;
  onClose: () => void;
  onRetrySource?: (() => void) | undefined;
  player: ReturnType<typeof useVodPlayer>;
  source: VodVideoSource | null;
  sourceError?: unknown;
};

/** VOD playback surface, chrome and error card. */
export function VodPlayerSurface({
  isLoading = false,
  onClose,
  onRetrySource,
  player,
  source,
  sourceError,
}: VodPlayerSurfaceProps) {
  const {
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
    shouldRenderControls,
    skipBySeconds,
    togglePlayback,
    toggleControlsFromBodyPress,
  } = player;

  // The advisory belongs to the first appearance of the controls only
  const hasHiddenControlsRef = useRef(false);

  if (!shouldRenderControls) {
    hasHiddenControlsRef.current = true;
  }

  const showAdvisory = !hasHiddenControlsRef.current;

  const handleRetry = () => {
    if (sourceError) {
      onRetrySource?.();
      return;
    }
    retry();
  };

  const handleErrorAction = useErrorAction({
    onCancel: onClose,
    onRetry: handleRetry,
  });

  const skipBackward = () => {
    markInteraction();
    skipBySeconds(-SKIP_SECONDS);
  };

  const skipForward = () => {
    markInteraction();
    skipBySeconds(SKIP_SECONDS);
  };

  const visibleErrorCode = sourceError
    ? mapPlaybackErrorToCode({ playSessionError: sourceError })
    : errorCode;

  const isRebuffering =
    hasStartedPlayback &&
    (playerState === PlaybackPlayerState.BUFFERING || isStalled);

  const isWaitingForFirstFrame =
    !hasStartedPlayback &&
    playerState !== PlaybackPlayerState.PAUSED &&
    (isLoading || Boolean(source));

  const showOverlay =
    !visibleErrorCode && Boolean(source) && shouldRenderControls;

  return (
    <PlayerStage
      PlayerView={PlayerView}
      hasSource={Boolean(source)}
      isLoading={!visibleErrorCode && (isWaitingForFirstFrame || isRebuffering)}
      loadingDelayMs={isRebuffering ? 0 : INITIAL_LOADING_DELAY_MS}
      loadingHasBackdrop={!isRebuffering}
      onPlayerError={handlePlayerError}
      onSkipBackward={skipBackward}
      onSkipForward={skipForward}
      onSourceError={handleSourceError}
      onStateChange={handleStateChange}
      onTimeUpdate={handleTimeUpdate}
      onToggleBody={toggleControlsFromBodyPress}
    >
      {showOverlay && source ? (
        <Animated.View
          className="absolute inset-0"
          pointerEvents="box-none"
          style={{ opacity: controlsOpacity }}
        >
          <VodPlayerOverlay
            durationSeconds={durationSeconds}
            layout={overlayLayout}
            onClose={onClose}
            onInteraction={markInteraction}
            onSeek={seekToProgress}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onTogglePlayback={togglePlayback}
            playerState={playerState}
            positionSeconds={positionSeconds}
            showAdvisory={showAdvisory}
            source={source}
          />
        </Animated.View>
      ) : null}

      {visibleErrorCode ? (
        <ErrorModal
          code={visibleErrorCode}
          onAction={handleErrorAction}
          withExitAction
        />
      ) : null}
    </PlayerStage>
  );
}
