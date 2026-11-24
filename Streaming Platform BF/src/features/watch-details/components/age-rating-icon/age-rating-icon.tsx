import type { FC } from "react";
import type { SvgProps } from "react-native-svg";
import Rating12Icon from "@/assets/icons/age-rating/12-icon.svg";
import Rating12aIcon from "@/assets/icons/age-rating/12a-icon.svg";
import Rating15Icon from "@/assets/icons/age-rating/15-icon.svg";
import Rating18Icon from "@/assets/icons/age-rating/18-icon.svg";
import RatingPgIcon from "@/assets/icons/age-rating/pg-icon.svg";
import RatingUIcon from "@/assets/icons/age-rating/u-icon.svg";
import type { AgeRatingLabel } from "@/features/watch-details/utils/watch-details-metadata";

const RATING_ICONS: Record<AgeRatingLabel, FC<SvgProps>> = {
  U: RatingUIcon,
  PG: RatingPgIcon,
  "12": Rating12Icon,
  "12A": Rating12aIcon,
  "15": Rating15Icon,
  "18": Rating18Icon,
};

const DEFAULT_SIZE = 16;

/** Age-rating badge, labelled so screen readers announce the rating. */
export function AgeRatingIcon({
  rating,
  size = DEFAULT_SIZE,
}: {
  rating: AgeRatingLabel;
  size?: number;
}) {
  const Icon = RATING_ICONS[rating];

  return (
    <Icon
      accessibilityLabel={`Rated ${rating}`}
      height={size}
      testID={`age-rating-${rating.toLowerCase()}`}
      width={size}
    />
  );
}
