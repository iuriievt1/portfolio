import type { ContentItem } from "@bfbs/common-sdk";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, Text } from "@/components";
import { getTileWidth } from "@/features/content-rails";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { PageTitle } from "../components/page-title";
import { ContentListCard } from "./content-list-card";
import { ContentListSkeleton } from "./content-list-skeleton";

type ContentListProps = {
  title: string;
  items: ContentItem[] | undefined;
  isPending: boolean;
  isError: boolean;
  emptyMessage: string;
  onItemPress: (item: ContentItem) => void;
  onRetry: () => void;
  // Extra content over each card's artwork, e.g. a progress bar.
  renderOverlay?: (item: ContentItem) => ReactNode;
  // Spoken after each card's title, e.g. "40% watched".
  getAccessibilityValue?: (item: ContentItem) => string | undefined;
};

// Shared page body for My List and Continue Watching: heading, then the list or its state.
export function ContentList({
  title,
  items = [],
  isPending,
  isError,
  emptyMessage,
  onItemPress,
  onRetry,
  renderOverlay,
  getAccessibilityValue,
}: ContentListProps) {
  const { isTablet } = useDeviceLayout();
  const artworkWidth = getTileWidth({
    isLandscape: false,
    isTablet,
    size: "standard",
  });

  let content: ReactNode;

  if (isPending) {
    content = <ContentListSkeleton artworkWidth={artworkWidth} />;
  } else if (isError && items.length === 0) {
    content = (
      <View accessibilityLiveRegion="polite" className="items-start gap-4">
        <Text
          accessibilityRole="alert"
          className="text-[16px] text-white"
          weight="semibold"
        >
          We couldn't load {title}.
        </Text>
        <Button onPress={onRetry} testID="content-list-retry">
          Try again
        </Button>
      </View>
    );
  } else if (items.length === 0) {
    content = (
      <Text
        className={`${isTablet ? "text-[18px]" : "text-[14px]"} text-white`}
      >
        {emptyMessage}
      </Text>
    );
  } else {
    // TODO: If there are performance issues with the list, migrate to FlatList.
    content = (
      <View className="gap-4">
        {items.map((item) => (
          <ContentListCard
            accessibilityValue={getAccessibilityValue?.(item)}
            artworkWidth={artworkWidth}
            item={item}
            key={item.id}
            onPress={() => onItemPress(item)}
            overlay={renderOverlay?.(item)}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4">
      <PageTitle>{title}</PageTitle>
      {content}
    </View>
  );
}
