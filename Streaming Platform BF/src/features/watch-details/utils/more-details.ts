import type { ContentItem } from "@bfbs/common-sdk";
import {
  type AgeRatingLabel,
  getSynopsis,
  resolveAgeRating,
} from "@/features/watch-details/utils/watch-details-metadata";

export function formatCredits(names: string[] | undefined): string | undefined {
  if (names === undefined) {
    return undefined;
  }

  const filtered = names.filter((name) => name.length > 0);

  return filtered.length > 0 ? filtered.join(", ") : undefined;
}

export function getContentWarning(
  asset: Pick<ContentItem, "contentAdvisories">,
): string | undefined {
  const labels = asset.contentAdvisories
    ?.map((advisory) => advisory.label)
    .filter(
      (label): label is string => label !== undefined && label.length > 0,
    );

  return labels !== undefined && labels.length > 0
    ? labels.join(", ")
    : undefined;
}

export type MoreDetails = {
  cast: string | undefined;
  crew: string | undefined;
  description: string | undefined;
  rating: AgeRatingLabel | undefined;
  released: string | undefined;
  warning: string | undefined;
};

export function getMoreDetails(asset: ContentItem): MoreDetails {
  return {
    cast: formatCredits(asset.credits?.actors),
    crew: formatCredits(asset.credits?.directors),
    description: getSynopsis(asset) || undefined,
    rating: resolveAgeRating(asset.parentalRating),
    released:
      asset.productionYear === undefined
        ? undefined
        : String(asset.productionYear),
    warning: getContentWarning(asset),
  };
}

/** Whether any More Details section has content. */
export function hasMoreDetails(asset: ContentItem): boolean {
  return Object.values(getMoreDetails(asset)).some(
    (value) => value !== undefined,
  );
}
