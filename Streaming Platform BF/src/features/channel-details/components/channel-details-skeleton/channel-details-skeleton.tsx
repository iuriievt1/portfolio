import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getChannelDetailsTabletMetrics,
  TABLET_ARTWORK_GAP,
  TABLET_BACK_ICON_SIZE,
  TABLET_BLOCK_GAP,
  TABLET_EDGE_INSET,
} from "@/features/channel-details/utils/tablet-metrics";
import { HERO_ASPECT_RATIO } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { SkeletonBlock } from "@/features/watch-details/components/watch-details-skeleton/skeleton-block";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

const ACTION_PLACEHOLDER_CLASS = "h-[45px] rounded-full";
const BACK_PLACEHOLDER_WIDTH = 64;
const SYNOPSIS_LINE_GAP = 8;

function PhoneHeroSkeleton() {
  return (
    <>
      <View
        className="w-full bg-medium-slate-blue"
        style={{ aspectRatio: HERO_ASPECT_RATIO }}
      />
      <View className="px-4 pt-4">
        <SkeletonBlock className="h-[35px] w-3/4 rounded" />
        <SkeletonBlock className="mt-4 h-[20px] w-2/5 rounded" />
        <View className="mt-4 gap-2">
          <SkeletonBlock className="h-[14px] rounded" />
          <SkeletonBlock className="h-[14px] rounded" />
          <SkeletonBlock className="h-[14px] w-2/3 rounded" />
        </View>
        <View className="mt-4 gap-2">
          <SkeletonBlock className={ACTION_PLACEHOLDER_CLASS} />
          <SkeletonBlock className={ACTION_PLACEHOLDER_CLASS} />
        </View>
      </View>
    </>
  );
}

function TabletHeroSkeleton({
  isLandscape,
  width,
}: {
  isLandscape: boolean;
  width: number;
}) {
  const metrics = getChannelDetailsTabletMetrics({ isLandscape, width });
  const artworkHeight = metrics.artworkWidth / HERO_ASPECT_RATIO;

  return (
    <View style={{ paddingTop: metrics.backTopInset }}>
      <SkeletonBlock
        className="rounded"
        style={{
          height: TABLET_BACK_ICON_SIZE,
          marginLeft: TABLET_EDGE_INSET,
          width: BACK_PLACEHOLDER_WIDTH,
        }}
      />
      <View
        className="flex-row"
        style={{
          alignItems: "flex-start",
          gap: TABLET_ARTWORK_GAP,
          marginTop: metrics.titleGap,
          paddingHorizontal: TABLET_EDGE_INSET,
        }}
      >
        <View
          className="flex-1"
          style={{
            justifyContent: isLandscape ? "center" : "flex-start",
            minHeight: artworkHeight,
          }}
        >
          <SkeletonBlock className="h-[35px] w-3/4 rounded" />
          <SkeletonBlock
            className="h-[20px] w-2/5 rounded"
            style={{ marginTop: TABLET_BLOCK_GAP }}
          />
          <View style={{ gap: SYNOPSIS_LINE_GAP, marginTop: TABLET_BLOCK_GAP }}>
            <SkeletonBlock className="h-[16px] rounded" />
            <SkeletonBlock className="h-[16px] w-2/3 rounded" />
          </View>
          {isLandscape ? null : <View className="flex-1" />}
          <View
            className="flex-row"
            style={{ gap: TABLET_BLOCK_GAP, marginTop: TABLET_BLOCK_GAP }}
          >
            <SkeletonBlock
              className={ACTION_PLACEHOLDER_CLASS}
              style={{ width: metrics.buttonWidth }}
            />
            <SkeletonBlock
              className={ACTION_PLACEHOLDER_CLASS}
              style={{ width: metrics.buttonWidth }}
            />
          </View>
        </View>
        <SkeletonBlock
          className="rounded-lg"
          style={{ height: artworkHeight, width: metrics.artworkWidth }}
          testID="channel-details-skeleton-artwork"
        />
      </View>
    </View>
  );
}

/** Loading placeholder shaped like the live channel page, so nothing jumps. */
export function ChannelDetailsSkeleton() {
  const insets = useSafeAreaInsets();
  const opacity = usePulseOpacity();
  const { isLandscape, isTablet, width } = useDeviceLayout();

  return (
    <Animated.View
      accessibilityLabel="Loading channel"
      accessibilityRole="progressbar"
      style={{ opacity, paddingTop: insets.top }}
      testID="channel-details-skeleton"
    >
      {isTablet ? (
        <TabletHeroSkeleton isLandscape={isLandscape} width={width} />
      ) : (
        <PhoneHeroSkeleton />
      )}
    </Animated.View>
  );
}
