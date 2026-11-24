import type { ContentItem } from "@bfbs/common-sdk";
import { formatEpisodePosition } from "@/utils/programme";

type VodEpisodeMetadata = {
  episodeNumber?: ContentItem["episodeNumber"] | null;
  episodeTitle?: ContentItem["episodeTitle"] | null;
  seasonNumber?: ContentItem["seasonNumber"] | null;
};

function cleanMetadataValue(value: string | null | undefined) {
  const cleaned = value?.trim();

  return cleaned || undefined;
}

/** Formats optional VOD series metadata without empty labels or separators. */
export function formatVodEpisodeMetadata({
  episodeNumber,
  episodeTitle,
  seasonNumber,
}: VodEpisodeMetadata): string | undefined {
  const episodePosition = formatEpisodePosition({
    episodeNumber,
    seasonNumber,
  });
  const cleanEpisodeTitle = cleanMetadataValue(episodeTitle);

  if (episodePosition && cleanEpisodeTitle) {
    return `${episodePosition} : ${cleanEpisodeTitle}`;
  }

  return episodePosition || cleanEpisodeTitle;
}
