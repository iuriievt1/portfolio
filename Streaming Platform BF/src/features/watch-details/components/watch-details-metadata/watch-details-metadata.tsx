import type { ContentItem } from "@bfbs/common-sdk";
import { Fragment } from "react";
import { View } from "react-native";
import { MetadataDot, Text } from "@/components";
import { AgeRatingIcon } from "@/features/watch-details/components/age-rating-icon/age-rating-icon";
import {
  getAssetMetadataItems,
  resolveAgeRating,
} from "@/features/watch-details/utils/watch-details-metadata";

/** Dot-separated metadata row that closes up around the fields the feed omits. */
export function WatchDetailsMetadata({
  asset,
  items = getAssetMetadataItems(asset),
  textClassName = "text-oatmeal",
}: {
  asset: ContentItem;
  items?: string[];
  textClassName?: string;
}) {
  const rating = resolveAgeRating(asset.parentalRating);

  if (items.length === 0 && !rating) {
    return null;
  }

  return (
    <View
      className="flex-row flex-wrap items-center"
      testID="watch-details-metadata"
    >
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 ? <MetadataDot /> : null}
          <Text className={`text-[14px] ${textClassName}`} weight="normal">
            {item}
          </Text>
        </Fragment>
      ))}
      {rating ? (
        <Fragment>
          {items.length > 0 ? <MetadataDot /> : null}
          <AgeRatingIcon rating={rating} />
        </Fragment>
      ) : null}
    </View>
  );
}
