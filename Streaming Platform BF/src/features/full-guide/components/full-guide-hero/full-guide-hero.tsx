import type { ContentItem } from "@bfbs/common-sdk";
import { View } from "react-native";
import { BackButton, Text } from "@/components";
import {
  PHONE_DESCRIPTION_CLASS,
  PHONE_TITLE_CLASS,
  TABLET_DESCRIPTION_CLASS,
  TABLET_TITLE_CLASS,
} from "@/features/channel-details/components/channel-details-hero/channel-details-hero";
import { ChannelDetailsMetadata } from "@/features/channel-details/components/channel-details-metadata/channel-details-metadata";
import type { GuideMetrics } from "@/features/full-guide/utils/guide-metrics";
import {
  TABLET_ACTION_TEXT_CLASS,
  WatchDetailsActions,
} from "@/features/watch-details/components/watch-details-actions/watch-details-actions";
import {
  BACK_ICON_HEIGHT,
  BACK_ICON_WIDTH,
  WatchDetailsHero,
} from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { TabletHero } from "@/features/watch-details/components/watch-details-tablet/tablet-hero";
import { getTabletMetrics } from "@/features/watch-details/components/watch-details-tablet/tablet-metrics";
import { getSynopsis } from "@/features/watch-details/utils/watch-details-metadata";
import { pickProgrammeImageUrl } from "@/utils/media";

const BACK_TEST_ID = "full-guide-back";
const PHONE_TITLE_LINE_LIMIT = 1;
const TABLET_TITLE_LINE_LIMIT = 2;
const SYNOPSIS_LINE_LIMIT = 2;

type HeroDetailsProps = {
  isLive: boolean;
  isTablet: boolean;
  metrics: GuideMetrics;
  onWatchNow: () => void;
  programme: ContentItem | undefined;
  width: number;
};

function HeroDetails({
  isLive,
  isTablet,
  metrics,
  onWatchNow,
  programme,
  width,
}: HeroDetailsProps) {
  const synopsis = programme ? getSynopsis(programme) : undefined;
  const textWidth = { maxWidth: width * metrics.heroTextWidthRatio };

  return (
    <>
      <Text
        accessibilityRole="header"
        className={`${isTablet ? TABLET_TITLE_CLASS : PHONE_TITLE_CLASS} text-white`}
        numberOfLines={
          isTablet ? TABLET_TITLE_LINE_LIMIT : PHONE_TITLE_LINE_LIMIT
        }
        style={textWidth}
        testID="full-guide-hero-title"
        weight="semibold"
      >
        {programme?.title ?? ""}
      </Text>

      {programme ? (
        <View style={{ marginTop: metrics.heroTitleGap }}>
          <ChannelDetailsMetadata
            isLive={isLive}
            isTablet={isTablet}
            programme={programme}
          />
        </View>
      ) : null}

      {synopsis ? (
        <Text
          className={`${isTablet ? TABLET_DESCRIPTION_CLASS : PHONE_DESCRIPTION_CLASS} text-oatmeal`}
          numberOfLines={SYNOPSIS_LINE_LIMIT}
          style={{ marginTop: metrics.heroMetadataGap, ...textWidth }}
          testID="full-guide-hero-synopsis"
        >
          {synopsis}
        </Text>
      ) : null}

      {isLive ? (
        <View style={{ marginTop: metrics.heroSynopsisGap }}>
          <WatchDetailsActions
            buttonWidth={metrics.heroButtonWidth}
            onWatch={onWatchNow}
            showSecondary={false}
            textSizeClassName={isTablet ? TABLET_ACTION_TEXT_CLASS : undefined}
            watchLabel="Watch Now"
            watchTestID="full-guide-watch-now"
          />
        </View>
      ) : null}
    </>
  );
}

type FullGuideHeroProps = {
  isLandscape: boolean;
  isLive: boolean;
  isTablet: boolean;
  metrics: GuideMetrics;
  onBack: () => void;
  onWatchNow: () => void;
  programme: ContentItem | undefined;
  width: number;
};

/** Fixed hero for the selected programme, shaped like the watch details page. */
export function FullGuideHero({
  isLandscape,
  isLive,
  isTablet,
  metrics,
  onBack,
  onWatchNow,
  programme,
  width,
}: FullGuideHeroProps) {
  const imageUrl = pickProgrammeImageUrl(programme?.media);

  if (isTablet) {
    const heroMetrics = getTabletMetrics(isLandscape);
    const artworkWidth = width * metrics.heroArtworkWidthRatio;
    const artworkHeight = width * metrics.heroArtworkHeightRatio;

    return (
      <View style={{ minHeight: artworkHeight }} testID="full-guide-hero">
        <TabletHero
          imageUrl={imageUrl}
          metrics={heroMetrics}
          sizeStyle={{ height: artworkHeight, width: artworkWidth }}
          testID="full-guide-artwork"
        />

        <View style={{ paddingTop: heroMetrics.backTopInset }}>
          <BackButton
            iconHeight={BACK_ICON_HEIGHT}
            iconWidth={BACK_ICON_WIDTH}
            onPress={onBack}
            style={{ paddingLeft: metrics.edgeInset }}
            testID={BACK_TEST_ID}
          />

          <View
            style={{
              marginTop: heroMetrics.contentTopGap,
              paddingLeft: metrics.edgeInset,
            }}
          >
            <HeroDetails
              isLive={isLive}
              isTablet
              metrics={metrics}
              onWatchNow={onWatchNow}
              programme={programme}
              width={width}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View testID="full-guide-hero">
      <WatchDetailsHero
        backTestID={BACK_TEST_ID}
        imageUrl={imageUrl}
        onBack={onBack}
      />

      <View style={{ padding: metrics.edgeInset }}>
        <HeroDetails
          isLive={isLive}
          isTablet={false}
          metrics={metrics}
          onWatchNow={onWatchNow}
          programme={programme}
          width={width}
        />
      </View>
    </View>
  );
}
