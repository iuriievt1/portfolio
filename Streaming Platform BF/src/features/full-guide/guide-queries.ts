import { ContentCatalogue } from "@bfbs/common-sdk";
import { queryOptions, skipToken } from "@tanstack/react-query";
import type { GuideDay } from "@/features/full-guide/types";
import { getWindowDurationHours } from "@/features/full-guide/utils/guide-days";
import { MINUTE_MS } from "@/utils/date-time";

const GUIDE_REFRESH_INTERVAL_MS = 30 * MINUTE_MS;

/** The key every day of the guide is cached under. */
export const GUIDE_DAY_QUERY_KEY = ["fullGuide", "day"];

/** One request per day; the API ignores the window when a limit is set. */
export function guideDayQueryOptions({
  channelCount,
  day,
}: {
  channelCount: number;
  day: GuideDay;
}) {
  return queryOptions({
    queryFn:
      channelCount > 0
        ? () =>
            ContentCatalogue.getProgrammeGuide({
              from: new Date(day.startMs).toISOString(),
              size: channelCount,
              windowDuration: getWindowDurationHours(day),
            })
        : skipToken,
    queryKey: [...GUIDE_DAY_QUERY_KEY, day.key, channelCount],
    refetchInterval: GUIDE_REFRESH_INTERVAL_MS,
  });
}
