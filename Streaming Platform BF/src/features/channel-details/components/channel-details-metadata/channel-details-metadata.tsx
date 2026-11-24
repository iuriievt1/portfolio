import type { ContentItem } from "@bfbs/common-sdk";
import type { ReactNode } from "react";
import { View } from "react-native";
import LiveStatusIcon from "@/assets/icons/live-status-icon.svg";
import { MetadataDot, Text } from "@/components";
import { useListingTimeZone } from "@/features/my-bfbs/time-zone-preference-store";
import { AgeRatingIcon } from "@/features/watch-details/components/age-rating-icon/age-rating-icon";
import { resolveAgeRating } from "@/features/watch-details/utils/watch-details-metadata";
import { theme } from "@/theme/theme";
import { formatProgrammeOnAirWindow } from "@/utils/programme";

const LIVE_ICON_SIZE = 10;
const PHONE_AGE_RATING_SIZE = 16;
const PHONE_LABEL_CLASS = "text-[14px]";
const TABLET_AGE_RATING_SIZE = 20;
const TABLET_LABEL_CLASS = "text-[16px]";

function MetadataLabel({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <Text
      className={className}
      style={{ includeFontPadding: false }}
      weight="normal"
    >
      {children}
    </Text>
  );
}

/** Live metadata row: the status tag, the on-air window, and the age rating. */
export function ChannelDetailsMetadata({
  isLive = true,
  isTablet = false,
  programme,
}: {
  isLive?: boolean;
  isTablet?: boolean;
  programme: ContentItem;
}) {
  const timeZone = useListingTimeZone();
  const onAirWindow = formatProgrammeOnAirWindow(programme, timeZone);
  const rating = resolveAgeRating(programme.parentalRating);
  const labelClassName = isTablet ? TABLET_LABEL_CLASS : PHONE_LABEL_CLASS;
  const ageRatingSize = isTablet
    ? TABLET_AGE_RATING_SIZE
    : PHONE_AGE_RATING_SIZE;

  return (
    <View
      accessible
      className="flex-row flex-wrap items-center"
      testID="channel-details-metadata"
    >
      {isLive ? (
        <LiveStatusIcon
          color={theme.colors.red}
          height={LIVE_ICON_SIZE}
          width={LIVE_ICON_SIZE}
        />
      ) : null}
      <MetadataLabel
        className={
          isLive
            ? `ml-1 ${labelClassName} text-red`
            : `${labelClassName} text-oatmeal`
        }
      >
        {isLive ? "LIVE" : "UPCOMING"}
      </MetadataLabel>
      {onAirWindow ? (
        <>
          <MetadataDot />
          <MetadataLabel className={`${labelClassName} text-oatmeal`}>
            {onAirWindow}
          </MetadataLabel>
        </>
      ) : null}
      {rating ? (
        <>
          <MetadataDot />
          <AgeRatingIcon rating={rating} size={ageRatingSize} />
        </>
      ) : null}
    </View>
  );
}
