import {
  type Channel,
  ContentCatalogue,
  type ProgrammeGuide,
} from "@bfbs/common-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getProgrammeGuideRefetchDelayMs } from "../now-and-next-refresh";
import { playableChannelsQueryOptions } from "../playable-channels";
import { sortByChannelNumber } from "../sort-channels";
import type { LiveChannel } from "../types";

const PROGRAMME_GUIDE_QUERY_KEY = ["liveChannels", "programmeGuide"];
const PROGRAMME_LIMIT = 2;

function withNowAndNext(
  channels: Channel[],
  guide: ProgrammeGuide | undefined,
): LiveChannel[] {
  const programmesByChannelId = new Map(
    (guide?.channels ?? []).map((guideChannel) => [
      guideChannel.channelId,
      guideChannel.programmes,
    ]),
  );

  return sortByChannelNumber(
    channels.map((channel) => {
      const programmes = programmesByChannelId.get(channel.id) ?? [];
      const liveChannel: LiveChannel = { ...channel };

      if (programmes[0]) {
        liveChannel.currentProgramme = programmes[0];
      }

      if (programmes[1]) {
        liveChannel.nextProgramme = programmes[1];
      }

      return liveChannel;
    }),
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Failed to load live channels";
}

/** Two queries: the line-up is expensive and near-static, the guide is not. */
export function useLiveChannels() {
  const queryClient = useQueryClient();

  const playableChannelsQuery = useQuery(playableChannelsQueryOptions());

  const totalChannels = playableChannelsQuery.data?.totalChannels ?? 0;

  const programmeGuideQuery = useQuery<ProgrammeGuide>({
    queryKey: [...PROGRAMME_GUIDE_QUERY_KEY, totalChannels],
    queryFn: () =>
      ContentCatalogue.getProgrammeGuide({
        programmeLimit: PROGRAMME_LIMIT,
        size: totalChannels,
      }),
    enabled: totalChannels > 0,
    refetchInterval: (query) =>
      getProgrammeGuideRefetchDelayMs(query.state.data),
    refetchIntervalInBackground: true,
    refetchOnMount: false,
    staleTime: (query) => {
      const updatedAtMs = query.state.dataUpdatedAt;

      if (!query.state.data || updatedAtMs === 0) {
        return 0;
      }

      return getProgrammeGuideRefetchDelayMs(query.state.data, updatedAtMs);
    },
  });

  const channels = withNowAndNext(
    playableChannelsQuery.data?.channels ?? [],
    programmeGuideQuery.data,
  );

  /** Pulls now/next immediately, for when playback crosses a boundary first. */
  const refreshLiveChannels = useCallback(
    () => queryClient.refetchQueries({ queryKey: PROGRAMME_GUIDE_QUERY_KEY }),
    [queryClient],
  );

  const error = playableChannelsQuery.error ?? programmeGuideQuery.error;

  return {
    channels,
    error: error ? getErrorMessage(error) : null,
    isLoading: playableChannelsQuery.isLoading,
    refreshLiveChannels,
  };
}
