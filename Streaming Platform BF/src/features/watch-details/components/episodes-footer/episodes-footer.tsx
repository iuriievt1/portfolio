import { View } from "react-native";
import { Button, Text } from "@/components";
import { ContentListSkeleton } from "@/features/my-bfbs/content-list/content-list-skeleton";
import { getEpisodeArtworkWidth } from "@/features/watch-details/components/episode-card/episode-card";
import { useDeviceLayout } from "@/hooks/use-device-layout";

const ERROR_MESSAGE = "We couldn't load the episodes.";

/** Under the episode rows: loading rows, an error with Try again, or nothing. */
export function EpisodesFooter({
  hasError,
  isLoading,
  isTablet,
  onRetry,
}: {
  hasError: boolean;
  isLoading: boolean;
  isTablet: boolean;
  onRetry: () => void;
}) {
  const { isLandscape } = useDeviceLayout();

  if (isLoading) {
    return (
      <ContentListSkeleton
        artworkWidth={getEpisodeArtworkWidth({ isLandscape, isTablet })}
      />
    );
  }

  if (!hasError) {
    return null;
  }

  return (
    <View className="items-center py-8" testID="episodes-error">
      <Text className="text-[14px] text-transparent-white-50" weight="normal">
        {ERROR_MESSAGE}
      </Text>
      <Button className="mt-3" onPress={onRetry} testID="episodes-retry">
        Try again
      </Button>
    </View>
  );
}
