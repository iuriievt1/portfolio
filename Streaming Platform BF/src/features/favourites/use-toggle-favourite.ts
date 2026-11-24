import { UserProfile } from "@bfbs/common-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reportError } from "@/infra/error";
import { FAVOURITES_QUERY_KEY } from "./use-favourites";

// An asset or a whole show, and whether it is in My List now.
type ToggleFavouriteInput = { isFavourite: boolean } & (
  | { assetId: string }
  | { showId: string }
);

// Adds an asset or show to My List, or removes it when it is already there.
export function useToggleFavourite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ToggleFavouriteInput) => {
      if ("showId" in input) {
        return input.isFavourite
          ? UserProfile.removeFromFavourites(input.showId)
          : UserProfile.addToFavourites({ showId: input.showId });
      }

      return input.isFavourite
        ? UserProfile.removeFromFavourites(input.assetId)
        : UserProfile.addToFavourites({ assetId: input.assetId });
    },
    onError: (error) => {
      reportError(error, {
        tags: { area: "my-list", operation: "toggle_favourite" },
      });
    },
    onSettled: (_data, _error, input) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: FAVOURITES_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey:
            "showId" in input
              ? ["show", input.showId]
              : ["asset", input.assetId],
        }),
      ]),
  });
}
