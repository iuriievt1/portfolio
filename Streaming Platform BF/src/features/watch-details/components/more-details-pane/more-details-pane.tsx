import type { ContentItem } from "@bfbs/common-sdk";
import type { ReactNode } from "react";
import { View } from "react-native";
import {
  MoreDetailsRatedSection,
  MoreDetailsTextSection,
  PHONE_MORE_DETAILS_SIZE,
} from "@/features/watch-details/components/more-details-pane/more-details-sections";
import { getMoreDetails } from "@/features/watch-details/utils/more-details";

type MoreDetailsSection = {
  gapClass: string;
  key: string;
  node: ReactNode;
};

export function MoreDetailsPane({ asset }: { asset: ContentItem }) {
  const { cast, crew, description, rating, released, warning } =
    getMoreDetails(asset);

  const candidates: (MoreDetailsSection | null)[] = [
    description
      ? {
          gapClass: "",
          key: "description",
          node: (
            <MoreDetailsTextSection
              body={description}
              size={PHONE_MORE_DETAILS_SIZE}
              title="Description"
            />
          ),
        }
      : null,
    released
      ? {
          gapClass: "mt-6",
          key: "released",
          node: (
            <MoreDetailsTextSection
              body={released}
              size={PHONE_MORE_DETAILS_SIZE}
              title="Released"
            />
          ),
        }
      : null,
    rating !== undefined || warning !== undefined
      ? {
          gapClass: "mt-6",
          key: "rated",
          node: (
            <MoreDetailsRatedSection
              rating={rating}
              size={PHONE_MORE_DETAILS_SIZE}
              warning={warning}
            />
          ),
        }
      : null,
    cast
      ? {
          gapClass: "mt-6",
          key: "cast",
          node: (
            <MoreDetailsTextSection
              body={cast}
              size={PHONE_MORE_DETAILS_SIZE}
              title="Cast"
            />
          ),
        }
      : null,
    crew
      ? {
          gapClass: "mt-6",
          key: "crew",
          node: (
            <MoreDetailsTextSection
              body={crew}
              size={PHONE_MORE_DETAILS_SIZE}
              title="Crew"
            />
          ),
        }
      : null,
  ];

  const sections = candidates.filter(
    (section): section is MoreDetailsSection => section !== null,
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <View>
      {sections.map((section, index) => (
        <View className={index === 0 ? "" : section.gapClass} key={section.key}>
          {section.node}
        </View>
      ))}
    </View>
  );
}
