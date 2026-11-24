import { type Channel, ContentCatalogue } from "@bfbs/common-sdk";
import { queryOptions } from "@tanstack/react-query";

type PlayableChannels = {
  channels: Channel[];
  totalChannels: number;
};

async function loadPlayableChannels(): Promise<PlayableChannels> {
  const allChannels = await ContentCatalogue.getAllChannels();

  return {
    channels: allChannels.filter((channel) => channel.isPlayable !== false),
    totalChannels: allChannels.length,
  };
}

/** The line-up is expensive and near-static, so screens share one copy. */
export function playableChannelsQueryOptions() {
  return queryOptions({
    queryFn: loadPlayableChannels,
    queryKey: ["liveChannels", "playable"],
    refetchOnMount: false,
  });
}
