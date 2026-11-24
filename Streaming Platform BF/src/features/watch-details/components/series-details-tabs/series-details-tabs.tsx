import type { ContentItem } from "@bfbs/common-sdk";
import { type ReactNode, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import { usePlaybackLauncher } from "@/features/video-player";
import { EpisodeCard } from "@/features/watch-details/components/episode-card/episode-card";
import { EpisodesFooter } from "@/features/watch-details/components/episodes-footer/episodes-footer";
import { MoreDetailsPane } from "@/features/watch-details/components/more-details-pane/more-details-pane";
import { SeasonSelector } from "@/features/watch-details/components/season-selector/season-selector";
import { SeriesRelatedPane } from "@/features/watch-details/components/series-related-pane/series-related-pane";
import { TabletMoreDetails } from "@/features/watch-details/components/watch-details-tablet/tablet-more-details";
import {
  getActiveTab,
  WatchDetailsTabRow,
} from "@/features/watch-details/components/watch-details-tabs/watch-details-tab-row";
import {
  getSeasonId,
  useSeasonEpisodes,
} from "@/features/watch-details/hooks/use-season-episodes";
import { useShowSeasons } from "@/features/watch-details/hooks/use-show-seasons";
import { hasMoreDetails } from "@/features/watch-details/utils/more-details";

type SeriesTab = "episodes" | "related" | "more-details";

const SERIES_TABS: { label: string; tab: SeriesTab }[] = [
  { label: "Episodes", tab: "episodes" },
  { label: "Related", tab: "related" },
  { label: "More Details", tab: "more-details" },
];

const INITIAL_EPISODE_COUNT = 4;
const EPISODES_PER_BATCH = 5;
const EPISODES_WINDOW_SIZE = 5;

function EpisodeGap() {
  return <View className="h-6" />;
}

/** A show's page as one list: the page top, the series picker and tabs, then the season's episodes. */
export function SeriesDetailsTabs({
  episodeSeasonId,
  hasEpisodes = true,
  header,
  isTablet = false,
  onScroll,
  show,
  showId,
  tabsGap,
}: {
  // The season of the episode Watch plays; the picker starts there.
  episodeSeasonId?: string | undefined;
  hasEpisodes?: boolean;
  // The page above the tabs: hero, title and buttons.
  header: ReactNode;
  isTablet?: boolean;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  show: ContentItem;
  showId: string | undefined;
  // Space between the page's buttons and the tabs.
  tabsGap: number;
}) {
  const [selectedTab, setSelectedTab] = useState<SeriesTab>("episodes");
  // Hide the tabs with nothing to show.
  const tabs = SERIES_TABS.filter(({ tab }) => {
    if (tab === "episodes") {
      return hasEpisodes;
    }
    if (tab === "more-details") {
      return hasMoreDetails(show);
    }
    return true;
  });
  // A show with no episodes opens on Related.
  const activeTab = getActiveTab(tabs, selectedTab);
  const {
    data: seasons = [],
    // Only a failed first load; a failed refresh keeps the seasons.
    isLoadingError: hasSeasonsError,
    isLoading: isLoadingSeasons,
    refetch: refetchSeasons,
  } = useShowSeasons(showId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>();
  // The picked season, else the Watch episode's, else the first.
  const selectedSeason =
    seasons.find((season) => season.id === selectedSeasonId) ??
    seasons.find((season) => getSeasonId(season) === episodeSeasonId) ??
    seasons[0];
  const {
    episodes,
    hasError,
    isLoadingFirstPage,
    isLoadingNextPage,
    loadNextPage,
    retry,
  } = useSeasonEpisodes(selectedSeason);
  const { openVodAsset } = usePlaybackLauncher();
  const isEpisodesTab = activeTab === "episodes";
  const isRelatedTab = activeTab === "related";
  const isMoreDetailsTab = activeTab === "more-details";
  const rows = isEpisodesTab ? episodes : [];
  const sidePadding = isTablet ? "px-[40px]" : "px-4";

  const handleEpisodePress = (episode: ContentItem) => {
    void openVodAsset({ id: episode.id, title: episode.title });
  };

  return (
    <FlatList
      ItemSeparatorComponent={EpisodeGap}
      ListFooterComponent={
        <View
          className={`${sidePadding} ${rows.length > 0 ? "pt-6" : ""}`}
          testID={`series-tab-pane-${activeTab}`}
        >
          {isEpisodesTab ? (
            <EpisodesFooter
              // Without seasons no episodes can load, so their error comes first.
              hasError={hasSeasonsError || hasError}
              isLoading={
                isLoadingSeasons || isLoadingFirstPage || isLoadingNextPage
              }
              isTablet={isTablet}
              onRetry={hasSeasonsError ? () => void refetchSeasons() : retry}
            />
          ) : null}
          {isRelatedTab ? (
            <SeriesRelatedPane
              isTablet={isTablet}
              show={show}
              showId={showId}
            />
          ) : null}
          {isMoreDetailsTab && isTablet ? (
            <TabletMoreDetails asset={show} />
          ) : null}
          {isMoreDetailsTab && !isTablet ? (
            <MoreDetailsPane asset={show} />
          ) : null}
        </View>
      }
      ListHeaderComponent={
        <>
          {header}
          <View
            className={`pb-4 ${sidePadding}`}
            style={{ marginTop: tabsGap }}
          >
            {/* The picker only changes the Episodes tab, so it shows only there. */}
            {isEpisodesTab && selectedSeason ? (
              <View className="mb-5">
                <SeasonSelector
                  isTablet={isTablet}
                  onSelect={(season) => setSelectedSeasonId(season.id)}
                  seasons={seasons}
                  selectedSeason={selectedSeason}
                />
              </View>
            ) : null}
            <WatchDetailsTabRow
              isTablet={isTablet}
              onSelect={setSelectedTab}
              selectedTab={activeTab}
              tabs={tabs}
            />
          </View>
        </>
      }
      className="flex-1"
      contentContainerClassName="pb-10"
      data={rows}
      initialNumToRender={INITIAL_EPISODE_COUNT}
      keyExtractor={(episode) => episode.id}
      maxToRenderPerBatch={EPISODES_PER_BATCH}
      // Loads the next 30 as the user nears the end, like View All.
      onEndReached={isEpisodesTab ? loadNextPage : undefined}
      onScroll={onScroll}
      renderItem={({ item }) => (
        <View className={sidePadding}>
          <EpisodeCard
            episode={item}
            isTablet={isTablet}
            onPress={handleEpisodePress}
          />
        </View>
      )}
      scrollEventThrottle={16}
      // Phone hides the scroll bar, as the page did before.
      showsVerticalScrollIndicator={isTablet}
      testID="watch-details-screen"
      windowSize={EPISODES_WINDOW_SIZE}
    />
  );
}
