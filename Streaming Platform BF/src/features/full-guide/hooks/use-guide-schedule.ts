import {
  type UseQueryResult,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  GUIDE_DAY_QUERY_KEY,
  guideDayQueryOptions,
} from "@/features/full-guide/guide-queries";
import { fillGuideGaps } from "@/features/full-guide/utils/guide-cells";
import {
  getFetchedRange,
  getGuideDays,
} from "@/features/full-guide/utils/guide-days";
import { mergeGuideChannels } from "@/features/full-guide/utils/merge-guide-channels";
import { toGuideChannels } from "@/features/full-guide/utils/to-guide-channels";
import { playableChannelsQueryOptions } from "@/features/live-channels";

// Module-level so useQueries keeps the combined result, and the channels derived from it, stable across renders.
function toDayResults<TResult extends UseQueryResult>(results: TResult[]) {
  return results.map(({ data, error, isLoading }) => ({
    data: data as TResult["data"],
    error,
    isLoading,
  }));
}

/** Loads and caches the full week so horizontal flings never outrun the data. */
export function useGuideSchedule({
  openedAtMs,
  visibleDayIndex,
}: {
  openedAtMs: number;
  visibleDayIndex: number;
}) {
  const days = useMemo(() => getGuideDays(openedAtMs), [openedAtMs]);
  const queryClient = useQueryClient();

  const channelsQuery = useQuery(playableChannelsQueryOptions());
  const channelCount = channelsQuery.data?.totalChannels ?? 0;

  const dayQueries = useQueries({
    combine: toDayResults,
    queries: days.map((day) => guideDayQueryOptions({ channelCount, day })),
  });

  const visibleDayQuery = dayQueries[visibleDayIndex];
  const hasDayData = visibleDayQuery?.data !== undefined;
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (hasDayData) {
      setHasOpened(true);
    }
  }, [hasDayData]);

  // Memoised for its identity: every row lays out its cells again whenever this changes, so a scroll that
  // only moves the visible day must hand the grid the very same channels.
  const guideChannels = useMemo(() => {
    const channels = channelsQuery.data?.channels ?? [];
    const loadedDays = days
      .filter((_day, index) => dayQueries[index]?.data !== undefined)
      .map(getFetchedRange);
    const channelsByDay = Object.fromEntries(
      days.map((day, index) => [
        day.key,
        toGuideChannels({ channels, guide: dayQueries[index]?.data }),
      ]),
    );

    return fillGuideGaps(mergeGuideChannels(channelsByDay), loadedDays);
  }, [channelsQuery.data, dayQueries, days]);

  const refresh = () => {
    void channelsQuery.refetch();
    void queryClient.refetchQueries({
      queryKey: GUIDE_DAY_QUERY_KEY,
      type: "active",
    });
  };

  return {
    channels: guideChannels,
    days,
    error:
      channelsQuery.error ??
      (hasOpened ? null : (visibleDayQuery?.error ?? null)),
    isLoading:
      channelsQuery.isLoading ||
      (!hasOpened && visibleDayQuery?.isLoading === true),
    refresh,
  };
}
