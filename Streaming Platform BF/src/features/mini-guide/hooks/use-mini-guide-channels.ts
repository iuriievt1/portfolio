import { useMemo } from "react";
import { useLiveChannels } from "@/features/live-channels";
import { toMiniGuideChannel } from "../utils/to-mini-guide-channel";

/** Maps live-channel query data into the mini-guide channel model. */
export function useMiniGuideChannels() {
  const { channels, error, isLoading } = useLiveChannels();
  const miniGuideChannels = useMemo(
    () => channels.map(toMiniGuideChannel),
    [channels],
  );

  return {
    channels: miniGuideChannels,
    error,
    isLoading,
  };
}
