import { MiniGuideOverlay } from "@/features/video-player/components/mini-guide-overlay";
import { PlayerPortal } from "@/features/video-player/components/player-portal";
import { PlayerSurface } from "@/features/video-player/components/player-surface";
import { useVideoPlayer } from "@/features/video-player/hooks/use-video-player";
import type { VideoPlayerProps } from "./types";

export function VideoPlayer({
  onClose,
  onOpenMiniGuide,
  onProgrammeBoundary,
  source,
  visible,
}: VideoPlayerProps) {
  const player = useVideoPlayer({ onProgrammeBoundary, source, visible });

  return (
    <PlayerPortal onClose={onClose} visible={visible}>
      <PlayerSurface
        miniGuide={
          source ? (
            <MiniGuideOverlay
              onClose={() => {
                player.markInteraction();
                player.setIsMiniGuideOpen(false);
              }}
              source={source}
            />
          ) : null
        }
        onClose={onClose}
        onOpenMiniGuide={onOpenMiniGuide}
        player={player}
        source={source}
      />
    </PlayerPortal>
  );
}
