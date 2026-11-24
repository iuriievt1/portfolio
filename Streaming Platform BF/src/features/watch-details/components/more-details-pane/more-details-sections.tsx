import { View } from "react-native";
import { Text } from "@/components";
import { AgeRatingIcon } from "@/features/watch-details/components/age-rating-icon/age-rating-icon";
import type { AgeRatingLabel } from "@/features/watch-details/utils/watch-details-metadata";

export type MoreDetailsSectionSize = {
  bodyClassName: string;
  dividerClassName: string;
  gapClassName: string;
  headerClassName: string;
  ratingIconSize: number;
};

export const PHONE_MORE_DETAILS_SIZE: MoreDetailsSectionSize = {
  bodyClassName: "text-[14px]",
  dividerClassName: "h-10",
  gapClassName: "gap-2",
  headerClassName: "text-[16px]",
  ratingIconSize: 16,
};

export const TABLET_LANDSCAPE_MORE_DETAILS_SIZE: MoreDetailsSectionSize = {
  bodyClassName: "text-[16px]",
  dividerClassName: "h-[46px]",
  gapClassName: "gap-4",
  headerClassName: "text-[18px]",
  ratingIconSize: 20,
};

// Portrait sits each heading closer to its text.
export const TABLET_PORTRAIT_MORE_DETAILS_SIZE: MoreDetailsSectionSize = {
  ...TABLET_LANDSCAPE_MORE_DETAILS_SIZE,
  gapClassName: "gap-2",
};

export function MoreDetailsTextSection({
  body,
  size,
  title,
}: {
  body: string;
  size: MoreDetailsSectionSize;
  title: string;
}) {
  return (
    <View className={size.gapClassName}>
      <Text className={`${size.headerClassName} text-white`} weight="semibold">
        {title}
      </Text>
      <Text className={`${size.bodyClassName} text-white`} weight="normal">
        {body}
      </Text>
    </View>
  );
}

export function MoreDetailsRatedSection({
  rating,
  size,
  warning,
}: {
  rating: AgeRatingLabel | undefined;
  size: MoreDetailsSectionSize;
  warning: string | undefined;
}) {
  return (
    <View className={size.gapClassName}>
      <Text className={`${size.headerClassName} text-white`} weight="semibold">
        Rated
      </Text>
      <View className="flex-row items-center gap-2">
        {rating ? (
          <>
            <AgeRatingIcon rating={rating} size={size.ratingIconSize} />
            <View
              className={`w-1 rounded-[2px] bg-transparent-white-20 ${size.dividerClassName}`}
            />
          </>
        ) : null}
        {warning ? (
          <View className="flex-1">
            <Text
              className={`${size.bodyClassName} text-white`}
              weight="normal"
            >
              {warning}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
