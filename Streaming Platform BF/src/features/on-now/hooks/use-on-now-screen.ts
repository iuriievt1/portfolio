import { useLiveChannels } from "@/features/live-channels";

/** Provides the On Now channel list. */
export function useOnNowScreen() {
  const { channels, error, isLoading } = useLiveChannels();

  return {
    areChannelsLoading: isLoading,
    channels,
    error,
  };
}
