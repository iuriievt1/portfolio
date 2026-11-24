import type { ContentItem } from "@bfbs/common-sdk";
import { View } from "react-native";
import PlayIcon from "@/assets/icons/play-icon.svg";
import { Text } from "@/components";
import { TileProgressBar } from "@/features/content-rails/components/content-tile/tile-progress-bar";
import { getContentDurationSeconds } from "@/features/content-rails/content";
import type { TileFormFactor } from "@/features/content-rails/types";
import { getTileFormFactor } from "@/features/content-rails/utils/tile-metrics";
import { ContentListCard } from "@/features/my-bfbs/content-list/content-list-card";
import {
  getContinueWatching,
  getSynopsis,
} from "@/features/watch-details/utils/watch-details-metadata";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { theme } from "@/theme/theme";

const SECONDS_PER_MINUTE = 60;

// Figma widths; the height follows from 16:9.
const ARTWORK_WIDTH: Record<TileFormFactor, number> = {
  phone: 168,
  tabletLandscape: 263,
  tabletPortrait: 267,
};

const LAYOUT = {
  phone: {
    playIcon: 8,
    playIndicator: "h-[20px] w-[20px]",
    text: "text-[12px]",
  },
  tablet: {
    playIcon: 12,
    playIndicator: "h-[30px] w-[30px]",
    text: "text-[14px]",
  },
};

export function getEpisodeLabel(
  episode: Pick<ContentItem, "episodeNumber" | "episodeTitle" | "title">,
) {
  const title = episode.episodeTitle ?? episode.title;

  return episode.episodeNumber ? `E${episode.episodeNumber} - ${title}` : title;
}

export function formatEpisodeDuration(
  episode: Parameters<typeof getContentDurationSeconds>[0],
) {
  const seconds = getContentDurationSeconds(episode);

  return seconds
    ? `${Math.round(seconds / SECONDS_PER_MINUTE)} min`
    : undefined;
}

/** The episode artwork width for the layout, shared by the cards and their loading rows. */
export function getEpisodeArtworkWidth({
  isLandscape,
  isTablet,
}: {
  isLandscape: boolean;
  isTablet: boolean;
}) {
  return ARTWORK_WIDTH[getTileFormFactor({ isLandscape, isTablet })];
}

/** An episode row on the content card: play icon and progress on the image, then title, duration and synopsis. */
export function EpisodeCard({
  episode,
  isTablet = false,
  onPress,
}: {
  episode: ContentItem;
  isTablet?: boolean;
  onPress: (episode: ContentItem) => void;
}) {
  const { isLandscape } = useDeviceLayout();
  const layout = isTablet ? LAYOUT.tablet : LAYOUT.phone;
  const duration = formatEpisodeDuration(episode);
  const synopsis = getSynopsis(episode);
  const continueWatching = getContinueWatching(episode);
  // The card speaks only its label, so the value carries the rest.
  const accessibilityValue = [
    duration,
    continueWatching
      ? `${Math.round(continueWatching.progress * 100)}% watched`
      : undefined,
  ]
    .filter(Boolean)
    .join(", ");

  const synopsisText = synopsis ? (
    <Text
      className={`${layout.text} tracking-[-0.056px] text-white`}
      numberOfLines={3}
    >
      {synopsis}
    </Text>
  ) : null;

  return (
    <ContentListCard
      accessibilityValue={accessibilityValue || undefined}
      artworkWidth={getEpisodeArtworkWidth({ isLandscape, isTablet })}
      // Phone puts the synopsis under the row; tablet keeps it beside the image.
      footer={isTablet ? undefined : synopsisText}
      isCompact={!isTablet}
      item={episode}
      label={getEpisodeLabel(episode)}
      onPress={() => onPress(episode)}
      overlay={
        <>
          <View
            className={`absolute top-2 right-2 items-center justify-center rounded-full bg-transparent-white-20 ${layout.playIndicator}`}
            pointerEvents="none"
            testID="episode-card-play"
          >
            <PlayIcon
              color={theme.colors.white}
              height={layout.playIcon}
              width={layout.playIcon}
            />
          </View>
          {continueWatching ? (
            <TileProgressBar progress={continueWatching.progress} />
          ) : null}
        </>
      }
    >
      {duration ? (
        <Text className={`${layout.text} text-white`} numberOfLines={1}>
          {duration}
        </Text>
      ) : null}
      {isTablet ? synopsisText : null}
    </ContentListCard>
  );
}
