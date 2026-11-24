import { Animated, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HERO_ASPECT_RATIO } from "@/features/watch-details/components/watch-details-hero/watch-details-hero";
import { SkeletonBlock } from "@/features/watch-details/components/watch-details-skeleton/skeleton-block";
import { usePulseOpacity } from "@/hooks/use-pulse-opacity";

export function WatchDetailsSkeleton() {
  const insets = useSafeAreaInsets();
  const opacity = usePulseOpacity();

  return (
    <View
      className="flex-1 bg-dark-slate-blue"
      style={{ paddingTop: insets.top }}
      testID="watch-details-skeleton"
    >
      <Animated.View style={{ opacity }}>
        <View
          className="w-full bg-medium-slate-blue"
          style={{ aspectRatio: HERO_ASPECT_RATIO }}
        />
        <View className="px-4 pt-4">
          <SkeletonBlock className="h-[24px] w-3/4 rounded" />
          <SkeletonBlock className="mt-4 h-[14px] w-2/5 rounded" />
          <View className="mt-4 gap-2">
            <SkeletonBlock className="h-[14px] rounded" />
            <SkeletonBlock className="h-[14px] rounded" />
            <SkeletonBlock className="h-[14px] w-2/3 rounded" />
          </View>
          <View className="mt-4 gap-2">
            <SkeletonBlock className="h-[45px] rounded-full" />
            <SkeletonBlock className="h-[45px] rounded-full" />
          </View>
          <View className="mt-[30px] flex-row gap-2">
            <SkeletonBlock className="h-8 w-[90px] rounded" />
            <SkeletonBlock className="h-8 w-[90px] rounded" />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
