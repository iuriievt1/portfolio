import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { VodPlayerSurface } from "@/features/video-player/components/vod-player-surface";
import { useVodPlayer } from "@/features/video-player/hooks/use-vod-player/use-vod-player";
import { useVodPlayerSource } from "@/features/video-player/hooks/use-vod-player/use-vod-player-source";
import type { VodAsset } from "@/features/video-player/types";

type VodPlayerProps = {
  asset: VodAsset | null;
  onClose: () => void;
  visible?: boolean;
};

/** Renders the VOD player and coordinates source loading, playback, and close flow. */
export function VodPlayer({ asset, onClose, visible = true }: VodPlayerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const {
    error: sourceError,
    isLoading,
    retry: retrySource,
    source,
  } = useVodPlayerSource(asset);

  const requestClose = () => {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
  };

  const player = useVodPlayer({
    onEnded: requestClose,
    source,
    visible: visible && !isClosing,
  });

  const hasClosedRef = useRef(false);

  useEffect(() => {
    if (!isClosing || hasClosedRef.current) {
      return;
    }

    hasClosedRef.current = true;
    onClose();
  }, [isClosing, onClose]);

  if (isClosing) {
    return <View className="flex-1 bg-black" testID="vod-player-closing" />;
  }

  return (
    <VodPlayerSurface
      key={asset?.id ?? "empty-vod-source"}
      isLoading={isLoading}
      onClose={requestClose}
      onRetrySource={retrySource}
      player={player}
      source={source}
      sourceError={sourceError}
    />
  );
}
