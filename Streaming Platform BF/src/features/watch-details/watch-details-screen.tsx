import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PlusIcon from "@/assets/icons/plus-icon.svg";
import TickIcon from "@/assets/icons/tick-icon.svg";
import { Text } from "@/components";
import { useToggleFavourite } from "@/features/favourites";
import { useListingTimeZone } from "@/features/my-bfbs/time-zone-preference-store";
import { usePlaybackLauncher } from "@/features/video-player";
import { ContinueWatchingBar } from "@/features/watch-details/components/continue-watching-bar/continue-watching-bar";
import { LeavingSoonBadge } from "@/features/watch-details/components/leaving-soon-badge/leaving-soon-badge";
import { NoEpisodesMessage } from "@/features/watch-details/components/no-episodes-message/no-episodes-message";
import { ScrollAwayGradient } from "@/features/watch-details/components/scroll-away-gradient/scroll-away-gradient";
import { SeriesDetailsTabs } from "@/features/watch-details/components/series-details-tabs/series-details-tabs";
import { WatchDetailsActions } from "@/features/watch-details/components/watch-details-actions/watch-details-actions";
import { WatchDetailsHero } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { WatchDetailsMetadata } from "@/features/watch-details/components/watch-details-metadata/watch-details-metadata";
import { WatchDetailsSkeleton } from "@/features/watch-details/components/watch-details-skeleton/watch-details-skeleton";
import { WatchDetailsTablet } from "@/features/watch-details/components/watch-details-tablet/watch-details-tablet";
import { WatchDetailsTabletSkeleton } from "@/features/watch-details/components/watch-details-tablet/watch-details-tablet-skeleton";
import { WatchDetailsTabs } from "@/features/watch-details/components/watch-details-tabs/watch-details-tabs";
import { useAsset } from "@/features/watch-details/hooks/use-asset";
import { useScrollAwayGradient } from "@/features/watch-details/hooks/use-scroll-away-gradient";
import { useShow } from "@/features/watch-details/hooks/use-show";
import { useShowEpisode } from "@/features/watch-details/hooks/use-show-episode";
import { useShowSeasons } from "@/features/watch-details/hooks/use-show-seasons";
import {
  getContinueWatching,
  getLeavingLabel,
  getSynopsis,
  hasWatchDetailsMetadata,
} from "@/features/watch-details/utils/watch-details-metadata";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import {
  ErrorFullScreen,
  errorCodes,
  mapLoadErrorToCode,
  useErrorAction,
} from "@/infra/error";
import { isContentUnavailableError } from "@/infra/error/utils/classify-error";
import { theme } from "@/theme/theme";
import { pickChannelLogoUrl, pickProgrammeImageUrl } from "@/utils/media";
import { formatEpisodePosition } from "@/utils/programme";

const SCROLL_GRADIENT_HEIGHT = 277;
const MY_LIST_ICON_SIZE = 16;
const SERIES_TABS_GAP = 30;

/** VOD watch-details page for an asset or a show: hero, actions, metadata, and the panes below. */
export function WatchDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { assetId, showId } = useLocalSearchParams<{
    assetId?: string;
    showId?: string;
  }>();
  const assetQuery = useAsset(assetId);
  const showQuery = useShow(showId);
  const {
    data: episode,
    error: episodeError,
    // Only a failed first load; a failed refresh keeps the page.
    isLoadingError: isEpisodeError,
    isLoading: isEpisodeLoading,
    refetch: refetchEpisode,
  } = useShowEpisode(showId);
  const { data: seasons, isLoading: isSeasonsLoading } = useShowSeasons(showId);

  const {
    data: asset,
    error,
    isError,
    isLoading,
    refetch,
  } = showId ? showQuery : assetQuery;

  const { isLandscape, isTablet } = useDeviceLayout();
  const { openVodAsset } = usePlaybackLauncher();
  const { onScroll, opacity } = useScrollAwayGradient();
  const toggleMyList = useToggleFavourite();
  const timeZone = useListingTimeZone();

  const handleBack = () => {
    router.back();
  };

  const handleErrorAction = useErrorAction({
    onCancel: handleBack,
    onRetry: () => {
      void refetch();

      if (isEpisodeError) {
        void refetchEpisode();
      }
    },
  });

  if (isLoading || isEpisodeLoading || isSeasonsLoading) {
    return isTablet ? (
      <WatchDetailsTabletSkeleton isLandscape={isLandscape} />
    ) : (
      <WatchDetailsSkeleton />
    );
  }

  if (isError || isEpisodeError || !asset) {
    const loadError = error ?? episodeError;

    return (
      <ErrorFullScreen
        code={
          !loadError || isContentUnavailableError(loadError)
            ? errorCodes.contentRemoved
            : mapLoadErrorToCode(loadError)
        }
        onAction={handleErrorAction}
      />
    );
  }

  // A show with no synopsis uses its episode's.
  const synopsis =
    getSynopsis(asset) ?? (episode ? getSynopsis(episode) : undefined);
  const leavingLabel = getLeavingLabel({
    expirationDateTime: asset.expirationDateTime,
    nowMs: Date.now(),
    timeZone,
  });
  const hasEpisodes = episode !== null && seasons?.length !== 0;
  const heroAsset =
    hasEpisodes && episode && getContinueWatching(episode) ? episode : asset;
  // A show's metadata comes from its episode, the one Watch plays.
  const metadataAsset = episode ?? asset;
  // Image order: the hero item's, the show's, then the selected episode's.
  const heroImageUrl =
    pickProgrammeImageUrl(heroAsset.media) ??
    pickProgrammeImageUrl(asset.media) ??
    pickProgrammeImageUrl(episode?.media);
  // The provider logo comes from the show's channel, else its episode's.
  const channelLogoUrl =
    pickChannelLogoUrl(asset.channel?.media) ??
    pickChannelLogoUrl(episode?.channel?.media);
  const continueWatching = getContinueWatching(heroAsset);
  // A show's button names its episode with the numbers it has, e.g. "Watch S1 E1" or "Watch E1".
  const episodePosition = formatEpisodePosition({
    episodeNumber: episode?.episodeNumber,
    seasonNumber: episode?.seasonNumber,
  });
  const watchLabel = `${continueWatching ? "Resume" : "Watch"}${episodePosition ? ` ${episodePosition}` : ""}`;

  const handleWatch = () => {
    // A show plays its episode, never the show id.
    const playable = showId ? episode : asset;

    if (playable) {
      void openVodAsset({ id: playable.id, title: playable.title });
    }
  };

  // While saving, show where the item is going so the icon changes at once.
  const isInMyList =
    toggleMyList.isPending && toggleMyList.variables
      ? !toggleMyList.variables.isFavourite
      : asset.isFavourite === true;

  const handleMyList = () => {
    if (!toggleMyList.isPending) {
      // A show page saves the whole show.
      toggleMyList.mutate(
        showId
          ? { isFavourite: isInMyList, showId }
          : { assetId: asset.id, isFavourite: isInMyList },
      );
    }
  };

  const MyListIcon = isInMyList ? TickIcon : PlusIcon;
  const myListIcon = (
    <MyListIcon
      color={theme.colors.white}
      height={MY_LIST_ICON_SIZE}
      width={MY_LIST_ICON_SIZE}
    />
  );

  if (isTablet) {
    return (
      <WatchDetailsTablet
        asset={asset}
        channelLogoUrl={channelLogoUrl}
        episodeSeasonId={episode?.seasonId}
        hasEpisodes={hasEpisodes}
        heroAsset={heroAsset}
        heroImageUrl={heroImageUrl}
        isLandscape={isLandscape}
        isShow={Boolean(showId)}
        leavingLabel={leavingLabel}
        metadataAsset={metadataAsset}
        myListIcon={myListIcon}
        onBack={handleBack}
        onMyList={handleMyList}
        onWatch={handleWatch}
        showId={showId}
        synopsis={synopsis}
        watchLabel={watchLabel}
      />
    );
  }

  // Hero, title and buttons; the series tabs or the asset tabs go below.
  const pageTop = (
    <>
      <WatchDetailsHero
        backTestID="watch-details-back"
        channelLogoUrl={channelLogoUrl}
        imageUrl={heroImageUrl}
        onBack={handleBack}
      />
      <View className="px-4 pt-4">
        <Text
          className="text-[26px] leading-[35px] tracking-[-0.1px] text-white"
          weight="semibold"
        >
          {asset.title}
        </Text>
        {leavingLabel ? (
          <View className="mt-4">
            <LeavingSoonBadge label={leavingLabel} />
          </View>
        ) : null}
        {hasWatchDetailsMetadata(metadataAsset) ? (
          <View className="mt-4">
            <WatchDetailsMetadata asset={metadataAsset} />
          </View>
        ) : null}
        {synopsis ? (
          <View className="mt-4">
            <Text
              className="text-body-small text-oatmeal"
              numberOfLines={3}
              weight="normal"
            >
              {synopsis}
            </Text>
          </View>
        ) : null}
        {continueWatching ? (
          <View className="mt-4">
            <ContinueWatchingBar
              progress={continueWatching.progress}
              remainingSeconds={continueWatching.remainingSeconds}
            />
          </View>
        ) : null}
        <View className="mt-4">
          <WatchDetailsActions
            onSecondary={handleMyList}
            onWatch={handleWatch}
            secondaryIcon={myListIcon}
            showWatch={hasEpisodes}
            watchLabel={watchLabel}
          />
        </View>
        {hasEpisodes ? null : (
          <View className="mt-3">
            <NoEpisodesMessage />
          </View>
        )}
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-dark-slate-blue">
      {showId ? (
        <SeriesDetailsTabs
          episodeSeasonId={episode?.seasonId}
          hasEpisodes={hasEpisodes}
          header={<View style={{ paddingTop: insets.top }}>{pageTop}</View>}
          onScroll={onScroll}
          show={asset}
          showId={showId}
          tabsGap={SERIES_TABS_GAP}
        />
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-10"
          contentContainerStyle={{ paddingTop: insets.top }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          testID="watch-details-screen"
        >
          {pageTop}
          <View className="px-4">
            <WatchDetailsTabs asset={asset} />
          </View>
        </ScrollView>
      )}
      <ScrollAwayGradient height={SCROLL_GRADIENT_HEIGHT} opacity={opacity} />
    </View>
  );
}
