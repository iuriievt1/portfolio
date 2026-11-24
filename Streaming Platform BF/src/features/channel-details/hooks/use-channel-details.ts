import type { LiveChannel } from "@/features/live-channels";
import { useLiveChannels } from "@/features/live-channels";

type ChannelDetails = {
  channel: LiveChannel | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
};

/**
 * Live-channel details data. Reuses the `useLiveChannels` cache, so the
 * now-playing programme refreshes itself at the programme boundary.
 */
export function useChannelDetails(
  channelId: string | undefined,
): ChannelDetails {
  const { channels, error, isLoading, refreshLiveChannels } = useLiveChannels();

  return {
    channel: channelId
      ? (channels.find((candidate) => candidate.id === channelId) ?? null)
      : null,
    error,
    isLoading,
    refresh: () => {
      void refreshLiveChannels();
    },
  };
}
