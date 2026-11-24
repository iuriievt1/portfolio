import { Image } from "expo-image";
import { useWindowDimensions, View } from "react-native";
import { BackButton, ProgrammeArtwork, Text } from "@/components";
import { ChannelDetailsMetadata } from "@/features/channel-details/components/channel-details-metadata/channel-details-metadata";
import {
  getChannelDetailsTabletMetrics,
  TABLET_ARTWORK_GAP,
  TABLET_BACK_ICON_SIZE,
  TABLET_BLOCK_GAP,
  TABLET_EDGE_INSET,
  TABLET_LOGO_TOP_INSET,
} from "@/features/channel-details/utils/tablet-metrics";
import type { LiveChannel } from "@/features/live-channels";
import {
  TABLET_ACTION_TEXT_CLASS,
  WatchDetailsActions,
} from "@/features/watch-details/components/watch-details-actions/watch-details-actions";
import {
  HERO_ASPECT_RATIO,
  WatchDetailsHero,
} from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { getSynopsis } from "@/features/watch-details/utils/watch-details-metadata";
import { pickChannelLogoUrl, pickProgrammeImageUrl } from "@/utils/media";

export const BACK_TEST_ID = "channel-details-back";
const SYNOPSIS_LINE_LIMIT = 3;

const PHONE_BLOCK_GAP = 16;
export const PHONE_DESCRIPTION_CLASS = "text-body-small";
export const PHONE_TITLE_CLASS = "text-[26px] leading-[35px]";
export const TABLET_DESCRIPTION_CLASS = "text-[16px] leading-[20px]";
export const TABLET_TITLE_CLASS = "text-[28px] leading-[35px]";
const TABLET_TITLE_LINE_LIMIT = 1;

function HeroContent({
  blockGap,
  buttonWidth,
  channel,
  isTablet,
  onOpenTvGuide,
  onWatchLive,
  pinsActionsToBottom = false,
}: {
  blockGap: number;
  buttonWidth?: number;
  channel: LiveChannel;
  isTablet: boolean;
  onOpenTvGuide: () => void;
  onWatchLive: () => void;
  pinsActionsToBottom?: boolean;
}) {
  const programme = channel.currentProgramme;
  const synopsis = programme
    ? getSynopsis(programme)
    : (channel.synopsis ?? channel.tagline);

  return (
    <>
      <Text
        accessibilityRole="header"
        className={`${isTablet ? TABLET_TITLE_CLASS : PHONE_TITLE_CLASS} tracking-[-0.1px] text-white`}
        weight="semibold"
        {...(isTablet ? { numberOfLines: TABLET_TITLE_LINE_LIMIT } : {})}
      >
        {programme?.title ?? channel.name}
      </Text>
      {programme ? (
        <View style={{ marginTop: blockGap }}>
          <ChannelDetailsMetadata isTablet={isTablet} programme={programme} />
        </View>
      ) : null}
      {synopsis ? (
        <View style={{ marginTop: blockGap }}>
          <Text
            className={`${isTablet ? TABLET_DESCRIPTION_CLASS : PHONE_DESCRIPTION_CLASS} text-oatmeal`}
            numberOfLines={SYNOPSIS_LINE_LIMIT}
            weight="normal"
          >
            {synopsis}
          </Text>
        </View>
      ) : null}
      {pinsActionsToBottom ? <View className="flex-1" /> : null}
      <View style={{ marginTop: blockGap }}>
        <WatchDetailsActions
          buttonWidth={isTablet ? buttonWidth : undefined}
          direction={isTablet ? "row" : "column"}
          onSecondary={onOpenTvGuide}
          onWatch={onWatchLive}
          secondaryIcon={null}
          secondaryLabel="TV Guide"
          secondaryTestID="channel-details-tv-guide"
          textSizeClassName={isTablet ? TABLET_ACTION_TEXT_CLASS : undefined}
          watchLabel="Watch Live"
          watchTestID="channel-details-watch-live"
        />
      </View>
    </>
  );
}

function TabletHero({
  artworkUrl,
  channel,
  channelLogoUrl,
  isLandscape,
  onBack,
  onOpenTvGuide,
  onWatchLive,
}: {
  artworkUrl: string | undefined;
  channel: LiveChannel;
  channelLogoUrl: string | undefined;
  isLandscape: boolean;
  onBack: () => void;
  onOpenTvGuide: () => void;
  onWatchLive: () => void;
}) {
  const { width } = useWindowDimensions();
  const metrics = getChannelDetailsTabletMetrics({ isLandscape, width });
  const artworkHeight = metrics.artworkWidth / HERO_ASPECT_RATIO;
  const centresColumn = isLandscape;

  return (
    <View style={{ paddingTop: metrics.backTopInset }}>
      <BackButton
        iconHeight={TABLET_BACK_ICON_SIZE}
        iconWidth={TABLET_BACK_ICON_SIZE}
        onPress={onBack}
        style={{ paddingLeft: TABLET_EDGE_INSET }}
        testID={BACK_TEST_ID}
      />
      {channelLogoUrl ? (
        <Image
          accessibilityLabel={channel.name}
          contentFit="contain"
          source={channelLogoUrl}
          style={{
            height: metrics.logoSize,
            position: "absolute",
            right: TABLET_EDGE_INSET,
            top: TABLET_LOGO_TOP_INSET,
            width: metrics.logoSize,
          }}
          testID="channel-details-channel-logo"
        />
      ) : null}
      <View
        className="flex-row"
        style={{
          alignItems: "flex-start",
          gap: TABLET_ARTWORK_GAP,
          marginTop: metrics.titleGap,
          paddingHorizontal: TABLET_EDGE_INSET,
        }}
        testID="channel-details-hero-row"
      >
        <View
          className="flex-1"
          style={{
            justifyContent: centresColumn ? "center" : "flex-start",
            minHeight: artworkHeight,
          }}
          testID="channel-details-hero-column"
        >
          <HeroContent
            blockGap={TABLET_BLOCK_GAP}
            buttonWidth={metrics.buttonWidth}
            channel={channel}
            isTablet
            onOpenTvGuide={onOpenTvGuide}
            onWatchLive={onWatchLive}
            pinsActionsToBottom={!centresColumn}
          />
        </View>
        <View
          className="self-start overflow-hidden rounded-lg bg-medium-slate-blue"
          style={{ height: artworkHeight, width: metrics.artworkWidth }}
          testID="channel-details-artwork"
        >
          <ProgrammeArtwork imageUrl={artworkUrl} />
        </View>
      </View>
    </View>
  );
}

/** Live channel hero: stacked on phones, artwork beside the details on tablets. */
export function ChannelDetailsHero({
  channel,
  isLandscape,
  isTablet,
  onBack,
  onOpenTvGuide,
  onWatchLive,
}: {
  channel: LiveChannel;
  isLandscape: boolean;
  isTablet: boolean;
  onBack: () => void;
  onOpenTvGuide: () => void;
  onWatchLive: () => void;
}) {
  const artworkUrl = pickProgrammeImageUrl(channel.currentProgramme?.media);
  const channelLogoUrl = pickChannelLogoUrl(channel.media);

  if (isTablet) {
    return (
      <TabletHero
        artworkUrl={artworkUrl}
        channel={channel}
        channelLogoUrl={channelLogoUrl}
        isLandscape={isLandscape}
        onBack={onBack}
        onOpenTvGuide={onOpenTvGuide}
        onWatchLive={onWatchLive}
      />
    );
  }

  return (
    <>
      <WatchDetailsHero
        backTestID={BACK_TEST_ID}
        channelLogoUrl={channelLogoUrl}
        imageUrl={artworkUrl}
        onBack={onBack}
      />
      <View className="px-4 pt-4">
        <HeroContent
          blockGap={PHONE_BLOCK_GAP}
          channel={channel}
          isTablet={false}
          onOpenTvGuide={onOpenTvGuide}
          onWatchLive={onWatchLive}
        />
      </View>
    </>
  );
}
