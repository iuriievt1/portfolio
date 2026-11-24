import {
  ContentSource,
  ContinueWatchingRecentSource,
  UserProfile,
} from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";

export const CONTINUE_WATCHING_QUERY_KEY = ["continue-watching"] as const;
const CONTINUE_WATCHING_LIMIT = 30;

export function useContinueWatching() {
  return useQuery({
    queryFn: () =>
      UserProfile.getContinueWatchingList({
        limit: CONTINUE_WATCHING_LIMIT,
        // Partially watched only; the SDK default adds next episodes.
        recentSource: ContinueWatchingRecentSource.PARTIALLY_VIEWED,
        sources: [ContentSource.VOD],
      }),
    queryKey: CONTINUE_WATCHING_QUERY_KEY,
  });
}
