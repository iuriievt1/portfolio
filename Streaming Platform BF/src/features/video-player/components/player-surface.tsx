import type { ReactNode } from "react";
import { Animated } from "react-native";
import { PlayerOverlay } from "@/features/video-player/components/player-overlay";
import { PlayerScrim } from "@/features/video-player/components/player-overlay/player-scrim/player-scrim";
import { PlayerStage } from "@/features/video-player/components/player-stage";
import type { useVideoPlayer } from "@/features/video-player/hooks/use-video-player";
import { ErrorModal, useErrorAction } from "@/infra/error";
import type { VideoPlayerProps } from "../types";

type PlayerSurfaceProps = {
  errorCode?: string | null | undefined;
  hideControlsForMiniGuide?: boolean | undefined;
  isLoading?: boolean | undefined;
  miniGuide?: ReactNode | undefined;
  onClose: () => void;
  onOpenMiniGuide?: (() => void) | undefined;
  onRetrySource?: (() => void) | undefined;
  player: ReturnType<typeof useVideoPlayer>;
  source: VideoPlayerProps["source"];
};

export function PlayerSurface({
  errorCode,
  hideControlsForMiniGuide = false,
  isLoading = false,
  miniGuide,
  onClose,
  onOpenMiniGuide,
  onRetrySource,
  player,
  source,
}: PlayerSurfaceProps) {
  const {
    PlayerView,
    controlsOpacity,
    errorCode: playerErrorCode,
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
    seekToProgress,
    setIsMiniGuideOpen,
    shouldRenderControls,
    timing,
    togglePlayback,
    toggleControlsFromBodyPress,
  } = player;

  const handleToggleMiniGuide = () => {
    if (isMiniGuideOpen) {
      setIsMiniGuideOpen(false);
      return;
    }

    setIsMiniGuideOpen(true);
    onOpenMiniGuide?.();
  };

  const visibleErrorCode = errorCode ?? playerErrorCode;
  const isMiniGuideMode = hideControlsForMiniGuide && isMiniGuideOpen;
  const showOverlay =
    !visibleErrorCode &&
    Boolean(source) &&
    (isMiniGuideMode || shouldRenderControls);

  const handleErrorAction = useErrorAction({
    onCancel: onClose,
    onRetry: onRetrySource ?? retry,
  });

  return (
    <PlayerStage
      PlayerView={PlayerView}
      hasSource={Boolean(source)}
      isLoading={isLoading && !visibleErrorCode}
      onPlayerError={handlePlayerError}
      onSourceError={handleSourceError}
      onStateChange={handleStateChange}
      onTimeUpdate={handleTimeUpdate}
      onToggleBody={toggleControlsFromBodyPress}
    >
      {!visibleErrorCode && isMiniGuideOpen && source ? (
        <>
          <PlayerScrim />
          {miniGuide}
        </>
      ) : null}

      {showOverlay && source ? (
        <Animated.View
          className="absolute inset-0"
          pointerEvents="box-none"
          style={{ opacity: isMiniGuideMode ? 1 : controlsOpacity }}
        >
          <PlayerOverlay
            areControlsVisible
            hidesPlaybackControls={isMiniGuideMode}
            isBehindLive={isBehindLive}
            isMiniGuideOpen={isMiniGuideOpen}
            layout={overlayLayout}
            onClose={onClose}
            onInteraction={markInteraction}
            onSeek={seekToProgress}
            onTogglePlayback={togglePlayback}
            onToggleMiniGuide={handleToggleMiniGuide}
            playerState={playerState}
            source={source}
            timing={timing}
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
