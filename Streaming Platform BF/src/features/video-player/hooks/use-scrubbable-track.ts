import { useRef, useState } from "react";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import type { SeekRequest } from "@/features/video-player/types";
import { clamp } from "@/utils/number";

type UseScrubbableTrackParams = {
  enabled?: boolean;
  maxProgress?: number;
  onInteraction: () => void;
  onSeek: (request: SeekRequest) => void;
  seekWhileScrubbing?: boolean;
};

export function useScrubbableTrack({
  enabled = true,
  maxProgress = 1,
  onInteraction,
  onSeek,
  seekWhileScrubbing = false,
}: UseScrubbableTrackParams) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [scrubProgress, setScrubProgress] = useState<number | null>(null);
  const trackPageXRef = useRef<number | null>(null);

  function updateScrubProgress(event: GestureResponderEvent) {
    if (trackWidth <= 0) {
      return;
    }

    onInteraction();

    const { locationX, pageX } = event.nativeEvent;
    const trackPageX = trackPageXRef.current;
    const stableLocationX =
      trackPageX !== null && Number.isFinite(pageX)
        ? pageX - trackPageX
        : locationX;
    const progress = clamp({
      max: maxProgress,
      min: 0,
      value: stableLocationX / trackWidth,
    });

    setScrubProgress(progress);

    if (seekWhileScrubbing) {
      onSeek({ isFinalSeek: false, progress });
    }
  }

  const trackProps = {
    onLayout: (event: LayoutChangeEvent) => {
      setTrackWidth(event.nativeEvent.layout.width);
    },
    onResponderGrant: (event: GestureResponderEvent) => {
      const { locationX, pageX } = event.nativeEvent;
      trackPageXRef.current =
        Number.isFinite(locationX) && Number.isFinite(pageX)
          ? pageX - locationX
          : null;
      updateScrubProgress(event);
    },
    onResponderMove: updateScrubProgress,
    onResponderRelease: () => {
      onInteraction();

      if (scrubProgress !== null) {
        onSeek({ progress: scrubProgress });
      }

      setScrubProgress(null);
      trackPageXRef.current = null;
    },
    onResponderTerminate: () => {
      setScrubProgress(null);
      trackPageXRef.current = null;
    },
    onResponderTerminationRequest: () => false,
    onStartShouldSetResponder: () => enabled,
  };

  return { scrubProgress, trackProps, trackWidth };
}
