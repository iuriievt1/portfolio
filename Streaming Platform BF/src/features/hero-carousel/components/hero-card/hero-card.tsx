import type { ContentItem } from "@bfbs/common-sdk";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { type DimensionValue, StyleSheet, View } from "react-native";
import { MetadataDot, ProgrammeArtwork, Text } from "@/components";
import { ChannelDetailsMetadata } from "@/features/channel-details/components/channel-details-metadata/channel-details-metadata";
import { ChannelLogo } from "@/features/content-rails/components/content-tile/channel-logo";
import { getProviderContentType } from "@/features/content-rails/content";
import type { TileFormFactor } from "@/features/content-rails/types";
import { AgeRatingIcon } from "@/features/watch-details/components/age-rating-icon/age-rating-icon";
import { LeavingSoonBadge } from "@/features/watch-details/components/leaving-soon-badge/leaving-soon-badge";
import { WatchDetailsMetadata } from "@/features/watch-details/components/watch-details-metadata/watch-details-metadata";
import { TRANSPARENT_TO_DARK_GRADIENT } from "@/features/watch-details/utils/gradients";
import {
  getSynopsis,
  resolveAgeRating,
} from "@/features/watch-details/utils/watch-details-metadata";
import { pickImageUrlForAspectRatio, pickTitleArt } from "@/utils/media";
import { formatGenre } from "@/utils/programme";

// GO sometimes sends taxonomy ids such as "12~34" as genres.
const TAXONOMY_GENRE = /^\d+~\d+$/;

// Measured from the phone and tablet designs.
export const HERO_CARD_LAYOUT: Record<
  TileFormFactor,
  {
    aspectRatio: number;
    /** Logo box distance from the card's bottom-right corner. */
    logoInset: { bottom: number; right: number };
    logoSize: number;
    /** Where the artwork starts fading into the page, from the top. */
    scrimStart: number;
    textInset: number;
    titleArtSize: { height: number; width: number };
  }
> = {
  phone: {
    aspectRatio: 7 / 4,
    logoInset: { bottom: 8, right: 8 },
    logoSize: 45,
    scrimStart: 0.4,
    textInset: 8,
    titleArtSize: { height: 55, width: 174 },
  },
  tabletPortrait: {
    aspectRatio: 16 / 9,
    logoInset: { bottom: 14, right: 14 },
    logoSize: 60,
    scrimStart: 0.4423,
    textInset: 16,
    titleArtSize: { height: 78, width: 250 },
  },
  tabletLandscape: {
    // Same shape as portrait, so a rotate doesn't reshape the card.
    aspectRatio: 16 / 9,
    logoInset: { bottom: 20, right: 20 },
    logoSize: 60,
    scrimStart: 0.4423,
    textInset: 40,
    titleArtSize: { height: 89, width: 318 },
  },
};

// Keeps the text clear of the logo.
const TEXT_TO_LOGO_GAP = 16;
// Art taller than GO's 9:5 is capped at that height.
const TITLE_ART_MAX_HEIGHT_RATIO = 5 / 9;
// Metadata row (the 26px badge on upcoming events) + 3 description lines, so every phone card is the same height.
const PHONE_DETAILS_HEIGHT = 87;
const TABLET_BADGE_CLASSNAME =
  "h-[30px] border bg-transparent-black-80 px-[10px]";
const PHONE_AGE_RATING_SIZE = 16;
const TABLET_AGE_RATING_SIZE = 20;

// Shows, seasons and episodes read as "Series"; standalone VOD as "Film".
function getTypeLabel(item: ContentItem) {
  switch (getProviderContentType(item)) {
    case "episode":
    case "season":
    case "show":
      return "Series";
    case "standalone":
    case "vod":
      return "Film";
    default:
      return undefined;
  }
}

function getHeroMetadataItems(item: ContentItem) {
  return [
    item.genres
      ?.map(formatGenre)
      .filter((genre) => genre && !TAXONOMY_GENRE.test(genre))
      .slice(0, 2)
      .join(" "),
    getTypeLabel(item),
    item.productionYear?.toString(),
  ].filter((label): label is string => Boolean(label));
}

// An upcoming event's row: when to watch, then the rating.
function UpcomingMetadata({
  isPhone,
  item,
  label,
}: {
  isPhone: boolean;
  item: ContentItem;
  label: string;
}) {
  const rating = resolveAgeRating(item.parentalRating);

  return (
    <View className="flex-row items-center">
      {isPhone ? (
        <LeavingSoonBadge label={label} />
      ) : (
        <LeavingSoonBadge
          className={TABLET_BADGE_CLASSNAME}
          label={label}
          textClassName="text-[16px]"
        />
      )}
      {rating ? (
        <>
          <MetadataDot />
          <AgeRatingIcon
            rating={rating}
            size={isPhone ? PHONE_AGE_RATING_SIZE : TABLET_AGE_RATING_SIZE}
          />
        </>
      ) : null}
    </View>
  );
}

/** One Hero item. Phone puts metadata and description under the artwork; tablet puts them on it. */
export function HeroCard({
  formFactor,
  isLive = false,
  item,
  upcomingLabel,
  width,
}: {
  formFactor: TileFormFactor;
  isLive?: boolean;
  item: ContentItem;
  upcomingLabel?: string | undefined;
  width: DimensionValue;
}) {
  const {
    aspectRatio,
    logoInset,
    logoSize,
    scrimStart,
    textInset,
    titleArtSize,
  } = HERO_CARD_LAYOUT[formFactor];
  const isPhone = formFactor === "phone";
  const titleArt = pickTitleArt(item.media);
  const [failedTitleArtUrl, setFailedTitleArtUrl] = useState<string>();
  const showTitleArt = titleArt && titleArt.url !== failedTitleArtUrl;
  const synopsis = getSynopsis(item);
  const metadataItems = getHeroMetadataItems(item);
  const hasMetadata =
    isLive ||
    Boolean(upcomingLabel) ||
    metadataItems.length > 0 ||
    Boolean(resolveAgeRating(item.parentalRating));

  let metadata = <WatchDetailsMetadata asset={item} items={metadataItems} />;

  if (upcomingLabel) {
    metadata = (
      <UpcomingMetadata isPhone={isPhone} item={item} label={upcomingLabel} />
    );
  } else if (isLive) {
    metadata = <ChannelDetailsMetadata isTablet={!isPhone} programme={item} />;
  }

  const details = (
    <>
      {hasMetadata ? <View className="mt-2">{metadata}</View> : null}
      {synopsis ? (
        <Text
          className={`mt-2 text-oatmeal ${
            isPhone
              ? "text-[12px] leading-[15px] tracking-[-0.048px]"
              : "text-[16px] tracking-[-0.064px]"
          }`}
          numberOfLines={isPhone ? 3 : 2}
          weight="normal"
        >
          {synopsis}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={{ width }} testID="hero-card">
      <View
        className="overflow-hidden rounded-lg bg-medium-slate-blue"
        style={{ aspectRatio }}
      >
        <ProgrammeArtwork
          imageUrl={pickImageUrlForAspectRatio(item.media, aspectRatio)}
        />
        <LinearGradient
          colors={TRANSPARENT_TO_DARK_GRADIENT}
          locations={[scrimStart, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View className="absolute inset-x-0 bottom-0 flex-row items-end">
          <View
            className="flex-1"
            style={{ padding: textInset, paddingRight: TEXT_TO_LOGO_GAP }}
          >
            {showTitleArt ? (
              <Image
                accessibilityLabel={item.title}
                cachePolicy="memory-disk"
                contentFit="contain"
                contentPosition="left bottom"
                onError={() => setFailedTitleArtUrl(titleArt.url)}
                source={titleArt.url}
                style={{
                  aspectRatio:
                    titleArt.aspectRatio ??
                    titleArtSize.width / titleArtSize.height,
                  maxHeight: titleArtSize.width * TITLE_ART_MAX_HEIGHT_RATIO,
                  width: titleArtSize.width,
                }}
                testID="hero-card-title-art"
              />
            ) : (
              <Text
                className={
                  isPhone
                    ? "text-[18px] tracking-[-0.072px] text-white"
                    : "text-[28px] leading-[35px] text-white"
                }
                numberOfLines={1}
                weight="semibold"
              >
                {item.title}
              </Text>
            )}
            {isPhone ? null : details}
          </View>
          <View
            className="justify-center"
            pointerEvents="none"
            style={{
              height: logoSize,
              marginBottom: logoInset.bottom,
              marginRight: logoInset.right,
              width: logoSize,
            }}
          >
            <ChannelLogo
              contentPosition={isPhone ? "right center" : "center"}
              fallback={
                item.channel?.name ? (
                  <Text
                    className={`text-[12px] leading-[14px] text-white ${isPhone ? "text-right" : "text-center"}`}
                    numberOfLines={2}
                    testID="hero-card-channel-fallback"
                    textBreakStrategy="simple"
                    weight="bold"
                  >
                    {item.channel.name}
                  </Text>
                ) : null
              }
              media={item.channel?.media}
              name={item.channel?.name}
            />
          </View>
        </View>
      </View>
      {isPhone ? (
        <View className="px-2" style={{ height: PHONE_DETAILS_HEIGHT }}>
          {details}
        </View>
      ) : null}
    </View>
  );
}
