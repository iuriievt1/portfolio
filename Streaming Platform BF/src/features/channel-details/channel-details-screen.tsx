import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChannelDetailsBackground } from "@/features/channel-details/components/channel-details-background/channel-details-background";
import { ChannelDetailsHero } from "@/features/channel-details/components/channel-details-hero/channel-details-hero";
import { ChannelDetailsSkeleton } from "@/features/channel-details/components/channel-details-skeleton/channel-details-skeleton";
import { useChannelDetails } from "@/features/channel-details/hooks/use-channel-details";
import { usePlaybackLauncher } from "@/features/video-player";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import {
  ErrorFullScreen,
  errorCodes,
  mapLoadErrorToCode,
  useErrorAction,
} from "@/infra/error";

function ChannelDetailsShell({ children }: { children: ReactNode }) {
  return (
    <View className="flex-1 bg-dark-slate-blue">
      <ChannelDetailsBackground />
      {children}
    </View>
  );
}

/** Live-channel details page: the now-playing hero and its actions. */
export function ChannelDetailsScreen() {
  const router = useRouter();
  const { openLiveChannel } = usePlaybackLauncher();
  const insets = useSafeAreaInsets();
  const { isLandscape, isTablet } = useDeviceLayout();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();
  const { channel, error, isLoading, refresh } = useChannelDetails(channelId);

  const handleBack = () => {
    router.back();
  };

  const handleErrorAction = useErrorAction({
    onCancel: handleBack,
    onRetry: refresh,
  });

  if (isLoading) {
    return (
      <ChannelDetailsShell>
        <ChannelDetailsSkeleton />
      </ChannelDetailsShell>
    );
  }

  if (error || !channel) {
    return (
      <ErrorFullScreen
        code={error ? mapLoadErrorToCode(error) : errorCodes.contentUnavailable}
        onAction={handleErrorAction}
      />
    );
  }

  const handleOpenTvGuide = () => {
    router.navigate({
      params: { channelId: channel.id },
      pathname: "/tv-guide",
    });
  };

  const handleWatchLive = () => {
    void openLiveChannel(channel.id);
  };

  return (
    <ChannelDetailsShell>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        contentContainerStyle={{ paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
        testID="channel-details-screen"
      >
        <ChannelDetailsHero
          channel={channel}
          isLandscape={isLandscape}
          isTablet={isTablet}
          onBack={handleBack}
          onOpenTvGuide={handleOpenTvGuide}
          onWatchLive={handleWatchLive}
        />
      </ScrollView>
    </ChannelDetailsShell>
  );
}
