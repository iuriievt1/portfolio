import { UserProfile } from "@bfbs/common-sdk";
import { useQuery } from "@tanstack/react-query";

export const FAVOURITES_QUERY_KEY = ["favourites"] as const;

// Loads My List for the active profile, so each profile sees only its own.
export function useFavourites() {
  return useQuery({
    queryFn: () => UserProfile.getFavourites(),
    queryKey: FAVOURITES_QUERY_KEY,
  });
}
