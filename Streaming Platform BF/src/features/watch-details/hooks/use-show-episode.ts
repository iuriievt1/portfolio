import type { ContentItem } from "@bfbs/common-sdk";
import {
  ContinueWatchingRecentSource,
  ContinueWatchingShowFilterDefault,
  UserProfile,
} from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";
import { CONTINUE_WATCHING_QUERY_KEY } from "@/features/continue-watching/use-continue-watching";

/** Finds the show's episode to watch: the next or partly watched one, else the first. */
export function useShowEpisode(showId: string | undefined) {
  return useQuery<ContentItem | null>({
    enabled: !!showId,
    queryFn: async () => {
      if (!showId) {
        throw new Error("Cannot find an episode without a show id.");
      }

      const { items } = await UserProfile.getContinueWatchingList({
        limit: 1,
        recentSource: ContinueWatchingRecentSource.NEXT_EPISODES,
        showFilterDefault: ContinueWatchingShowFilterDefault.FIRST_EPISODE,
        showId,
      });

      return items[0] ?? null;
    },
    // Under continue-watching, so it refreshes after playback.
    queryKey: [...CONTINUE_WATCHING_QUERY_KEY, "show", showId],
  });
}
