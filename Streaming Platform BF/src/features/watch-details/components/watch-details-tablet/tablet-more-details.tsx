import type { ContentItem } from "@bfbs/common-sdk";
import { View } from "react-native";
import {
  MoreDetailsRatedSection,
  MoreDetailsTextSection,
  TABLET_LANDSCAPE_MORE_DETAILS_SIZE,
  TABLET_PORTRAIT_MORE_DETAILS_SIZE,
} from "@/features/watch-details/components/more-details-pane/more-details-sections";
import { getMoreDetails } from "@/features/watch-details/utils/more-details";
import { useDeviceLayout } from "@/hooks/use-device-layout";

export function TabletMoreDetails({ asset }: { asset: ContentItem }) {
  const { cast, crew, description, rating, released, warning } =
    getMoreDetails(asset);
  const hasRated = rating !== undefined || warning !== undefined;
  const hasLeftColumn = Boolean(description || released || hasRated);
  const { isLandscape } = useDeviceLayout();
  const size = isLandscape
    ? TABLET_LANDSCAPE_MORE_DETAILS_SIZE
    : TABLET_PORTRAIT_MORE_DETAILS_SIZE;
  // Space between sections: 40px landscape, 24px portrait.
  const columnClassName = isLandscape ? "flex-1 gap-10" : "flex-1 gap-6";

  const credits = (
    <>
      {cast ? (
        <MoreDetailsTextSection body={cast} size={size} title="Cast" />
      ) : null}
      {crew ? (
        <MoreDetailsTextSection body={crew} size={size} title="Crew" />
      ) : null}
    </>
  );

  return (
    <View className="flex-row gap-4">
      {/* With nothing on the left, Cast and Crew move into the left column. */}
      <View className={columnClassName}>
        {hasLeftColumn ? (
          <>
            {description ? (
              <MoreDetailsTextSection
                body={description}
                size={size}
                title="Description"
              />
            ) : null}
            {released ? (
              <MoreDetailsTextSection
                body={released}
                size={size}
                title="Released"
              />
            ) : null}
            {hasRated ? (
              <MoreDetailsRatedSection
                rating={rating}
                size={size}
                warning={warning}
              />
            ) : null}
          </>
        ) : (
          credits
        )}
      </View>
      <View className={columnClassName}>{hasLeftColumn ? credits : null}</View>
    </View>
  );
}
