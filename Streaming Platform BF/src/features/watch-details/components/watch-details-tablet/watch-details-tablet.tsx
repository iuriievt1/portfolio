import type { ContentItem } from "@bfbs/common-sdk";
import { type ReactNode, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, Text } from "@/components";
import { ContinueWatchingBar } from "@/features/watch-details/components/continue-watching-bar/continue-watching-bar";
import { LeavingSoonBadge } from "@/features/watch-details/components/leaving-soon-badge/leaving-soon-badge";
import { NoEpisodesMessage } from "@/features/watch-details/components/no-episodes-message/no-episodes-message";
import { ScrollAwayGradient } from "@/features/watch-details/components/scroll-away-gradient/scroll-away-gradient";
import { SeriesDetailsTabs } from "@/features/watch-details/components/series-details-tabs/series-details-tabs";
import { WatchDetailsActions } from "@/features/watch-details/components/watch-details-actions/watch-details-actions";
import { WatchDetailsMetadata } from "@/features/watch-details/components/watch-details-metadata/watch-details-metadata";
import { TabletHero } from "@/features/watch-details/components/watch-details-tablet/tablet-hero";
import {
  getTabletMetrics,
  getTextMaxWidth,
  HERO_SIZE_STYLE,
  TABLET_SCROLL_GRADIENT_HEIGHT,
} from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { TabletMoreDetails } from "@/features/watch-details/components/watch-details-tablet/tablet-more-details";
import { TabletRelatedPane } from "@/features/watch-details/components/watch-details-tablet/tablet-related-pane";
import {
  getActiveTab,
  WatchDetailsTabRow,
} from "@/features/watch-details/components/watch-details-tabs/watch-details-tab-row";
import {
  getWatchDetailsTabs,
  type WatchDetailsTab,
} from "@/features/watch-details/components/watch-details-tabs/watch-details-tabs";
import { useScrollAwayGradient } from "@/features/watch-details/hooks/use-scroll-away-gradient";
import { hasRelatedContent } from "@/features/watch-details/related-content";
import { hasMoreDetails } from "@/features/watch-details/utils/more-details";
import {
  getContinueWatching,
  hasWatchDetailsMetadata,
} from "@/features/watch-details/utils/watch-details-metadata";

const BACK_ICON_SIZE = 20;
const NO_EPISODES_GAP_LANDSCAPE = 40;
const NO_EPISODES_GAP_PORTRAIT = 20;

/** Tablet layout for the VOD watch-details page. */
export function WatchDetailsTablet({
  asset,
  channelLogoUrl,
  episodeSeasonId,
  hasEpisodes,
  heroAsset,
  heroImageUrl,
  isLandscape,
  isShow,
  leavingLabel,
  metadataAsset,
  myListIcon,
  onBack,
  onMyList,
  onWatch,
  showId,
  synopsis,
  watchLabel,
}: {
  asset: ContentItem;
  channelLogoUrl: string | undefined;
  episodeSeasonId: string | undefined;
  hasEpisodes: boolean;
  // Fills the image and progress; a show's partly watched episode.
  heroAsset: ContentItem;
  heroImageUrl: string | undefined;
  isLandscape: boolean;
  // A show page swaps Related / More Details for the series tabs.
  isShow: boolean;
  leavingLabel: string | undefined;
  // Fills the metadata row; a show's episode when the show has none.
  metadataAsset: ContentItem;
  myListIcon: ReactNode;
  onBack: () => void;
  onMyList: () => void;
  onWatch: () => void;
  showId: string | undefined;
  synopsis: string | undefined;
  watchLabel: string;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<WatchDetailsTab>("related");
  const showsRelated = hasRelatedContent(asset);
  const tabs = getWatchDetailsTabs(showsRelated, hasMoreDetails(asset));
  const activeTab = getActiveTab(tabs, selectedTab);
  const { onScroll, opacity } = useScrollAwayGradient();

  const metrics = getTabletMetrics(isLandscape);
  const textMaxWidth = getTextMaxWidth({ metrics, width });
  const continueWatching = getContinueWatching(heroAsset);

  // Hero, title and buttons; the series tabs or the asset tabs go below.
  const pageTop = (
    <View>
      <TabletHero
        channelLogoUrl={channelLogoUrl}
        imageUrl={heroImageUrl}
        metrics={metrics}
        sizeStyle={HERO_SIZE_STYLE}
      />

      <View style={{ paddingTop: insets.top + metrics.backTopInset }}>
        <BackButton
          className="pl-[41px]"
          iconHeight={BACK_ICON_SIZE}
          iconWidth={BACK_ICON_SIZE}
          onPress={onBack}
          testID="watch-details-back"
        />

        <View
          className="pl-[40px]"
          style={{ marginTop: metrics.contentTopGap }}
        >
          <Text
            className="text-[28px] leading-[35px] text-white"
            numberOfLines={2}
            style={{ maxWidth: textMaxWidth }}
            weight="semibold"
          >
            {asset.title}
          </Text>

          {leavingLabel ? (
            <View className="mt-[18px]">
              <LeavingSoonBadge
                className="h-[30px] border-[1.25px] px-[10px]"
                label={leavingLabel}
              />
            </View>
          ) : null}

          {hasWatchDetailsMetadata(metadataAsset) ? (
            <View style={{ marginTop: metrics.sectionGap }}>
              <WatchDetailsMetadata
                asset={metadataAsset}
                textClassName="text-white"
              />
            </View>
          ) : null}

          {synopsis ? (
            <Text
              className="text-[16px] text-oatmeal"
              numberOfLines={3}
              style={{
                marginTop: metrics.sectionGap,
                maxWidth: textMaxWidth,
              }}
              weight="normal"
            >
              {synopsis}
            </Text>
          ) : null}

          {continueWatching ? (
            <View
              style={{
                marginTop: metrics.blockGap,
                maxWidth: textMaxWidth,
              }}
            >
              <ContinueWatchingBar
                progress={continueWatching.progress}
                remainingSeconds={continueWatching.remainingSeconds}
                textClassName="text-[16px]"
              />
            </View>
          ) : null}

          <View style={{ marginTop: metrics.blockGap }}>
            <WatchDetailsActions
              buttonWidth={metrics.buttonWidth}
              direction="row"
              onSecondary={onMyList}
              onWatch={onWatch}
              secondaryIcon={myListIcon}
              showWatch={hasEpisodes}
              textSizeClassName="text-[16px]"
              watchLabel={watchLabel}
            />
          </View>

          {hasEpisodes ? null : (
            <View
              style={{
                marginTop: isLandscape
                  ? NO_EPISODES_GAP_LANDSCAPE
                  : NO_EPISODES_GAP_PORTRAIT,
              }}
            >
              <NoEpisodesMessage isTablet />
            </View>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-dark-slate-blue">
      {isShow ? (
        <SeriesDetailsTabs
          episodeSeasonId={episodeSeasonId}
          hasEpisodes={hasEpisodes}
          header={pageTop}
          isTablet
          onScroll={onScroll}
          show={asset}
          showId={showId}
          tabsGap={metrics.buttonsToTabsGap}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          onScroll={onScroll}
          scrollEventThrottle={16}
          testID="watch-details-screen"
        >
          {pageTop}

          {tabs.length > 0 ? (
            <>
              <View
                className="pl-[40px]"
                style={{ marginTop: metrics.buttonsToTabsGap }}
              >
                <WatchDetailsTabRow
                  isTablet
                  onSelect={setSelectedTab}
                  selectedTab={activeTab}
                  tabs={tabs}
                />
              </View>
              <View className="mt-4">
                {activeTab === "related" ? (
                  <TabletRelatedPane asset={asset} />
                ) : (
                  <View className="px-10">
                    <TabletMoreDetails asset={asset} />
                  </View>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
      <ScrollAwayGradient
        height={TABLET_SCROLL_GRADIENT_HEIGHT}
        opacity={opacity}
      />
    </View>
  );
}
