import type { ContentItem } from "@bfbs/common-sdk";
import { ContentCatalogue } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";

const SHOW_STALE_TIME_MS = 5 * 60 * 1000;

/** Loads a series or box set with the active profile's personal data. */
export function useShow(showId: string | undefined) {
  return useQuery<ContentItem>({
    enabled: !!showId,
    queryFn: () => {
      if (!showId) {
        throw new Error("Cannot load a show without an id.");
      }

      return ContentCatalogue.getShow({ showId, shared: false });
    },
    queryKey: ["show", showId],
    staleTime: SHOW_STALE_TIME_MS,
  });
}
