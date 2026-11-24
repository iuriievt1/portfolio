import type {
  Channel,
  ContentItem,
  ContentRail as RailPlacement,
} from "@bfbs/common-sdk";
import {
  Animated,
  FlatList,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import { ContentRail } from "@/features/content-rails/components/content-rail/content-rail";
import { ContinueWatchingRail } from "@/features/content-rails/components/continue-watching-rail/continue-watching-rail";
import { clearGridScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";
import { useRailScrollRestore } from "@/features/content-rails/hooks/use-rail-scroll-restore";
import type { PageRail } from "@/features/content-rails/types";
import { isContinueWatchingRail } from "@/features/content-rails/utils/rail-content";
import { HeroCarousel } from "@/features/hero-carousel/components/hero-carousel/hero-carousel";
import { getHeroItems } from "@/features/hero-carousel/utils/hero-carousel";
import type { LiveChannel } from "@/features/live-channels";
import { ChannelsRail } from "@/features/live-channels/components/channels-rail/channels-rail";
import { LiveChannelsRail } from "@/features/live-channels/components/live-channels-rail";
import { useListingTimeZone } from "@/features/my-bfbs/time-zone-preference-store";
import { PromoBanner } from "@/features/promo-banner/components/promo-banner/promo-banner";
import { useDeviceLayout } from "@/hooks/use-device-layout";

const INITIAL_RAIL_COUNT = 3;
const SCROLL_EVENT_THROTTLE_MS = 16;

type ForwardedListProps = Omit<
  FlatListProps<PageRail>,
  "data" | "keyExtractor" | "renderItem"
>;

interface PageRailsListProps {
  rails: PageRail[];
  listProps?: ForwardedListProps;
  onContentTilePress?: (rail: RailPlacement, tile: ContentItem) => void;
  onLiveTilePress?: (channel: LiveChannel) => void;
  onChannelPress?: (channel: Channel) => void;
  onViewAllPress?: (rail: RailPlacement) => void;
  railMemoryScope?: string;
}

/** Returns the vertical spacing used by page rail lists across phone and tablet layouts. */
function getPageRailClassName({ index }: { index: number }) {
  if (index !== 0) {
    return "mt-7";
  }

  return "mt-4";
}

/** Renders a list of mixed live and VOD page rails from caller-provided props. */
export function PageRailsList({
  rails,
  listProps,
  onContentTilePress,
  onLiveTilePress,
  onChannelPress,
  onViewAllPress,
  railMemoryScope = "default",
}: PageRailsListProps) {
  const { isLandscape, isTablet } = useDeviceLayout();
  const timeZone = useListingTimeZone();
  const {
    coverOpacity,
    handleScroll,
    handleScrollBeginDrag,
    listRef,
    markReturningFromViewAll,
  } = useRailScrollRestore();

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScroll(event);
    listProps?.onScroll?.(event);
  };

  const onScrollBeginDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    handleScrollBeginDrag();
    listProps?.onScrollBeginDrag?.(event);
  };

  const handleViewAllPress = onViewAllPress
    ? (rail: RailPlacement) => {
        markReturningFromViewAll();
        clearGridScrollMemory(rail.category.id);
        onViewAllPress(rail);
      }
    : undefined;
  return (
    <View className="flex-1 bg-dark-slate-blue">
      <FlatList
        className="flex-1 bg-dark-slate-blue"
        contentContainerClassName="pb-6"
        data={rails}
        initialNumToRender={INITIAL_RAIL_COUNT}
        keyExtractor={(rail) => rail.id}
        ref={listRef}
        renderItem={({ item, index }) => {
          const className = getPageRailClassName({ index });
          const sharedRailProps = {
            className,
            isLandscape,
            isPriority: index === 0,
            isTablet,
          };

          if (item.kind === "hero") {
            return (
              <HeroCarousel
                className={className}
                items={getHeroItems({
                  items: item.placement.items ?? [],
                  liveChannels: item.liveChannels,
                  nowMs: Date.now(),
                  onContentPress: (heroItem) =>
                    onContentTilePress?.(item.placement, heroItem),
                  onLivePress: onLiveTilePress,
                  timeZone,
                })}
              />
            );
          }

          if (item.kind === "promo") {
            return (
              <PromoBanner
                className={className}
                onContentPress={onContentTilePress}
                rail={item.placement}
              />
            );
          }

          if (item.kind === "live-channels") {
            if (item.error != null) {
              return null;
            }

            return (
              <LiveChannelsRail
                channels={item.channels}
                isLoading={item.isLoading}
                memoryKey={`${railMemoryScope}:${item.id}`}
                presentation={item.presentation}
                title={item.title}
                {...sharedRailProps}
                {...(onLiveTilePress ? { onTilePress: onLiveTilePress } : {})}
              />
            );
          }

          if (item.kind === "channels") {
            return (
              <ChannelsRail
                className={className}
                isLandscape={isLandscape}
                isLoading={item.isLoading}
                isTablet={isTablet}
                memoryKey={`${railMemoryScope}:${item.id}`}
                tiles={item.tiles}
                presentation={item.presentation}
                title={item.title}
                {...(onChannelPress ? { onTilePress: onChannelPress } : {})}
              />
            );
          }

          const Rail = isContinueWatchingRail(item.placement)
            ? ContinueWatchingRail
            : ContentRail;

          return (
            <Rail
              rail={item.placement}
              memoryKey={`${railMemoryScope}:${item.id}`}
              {...sharedRailProps}
              {...(onContentTilePress
                ? { onTilePress: onContentTilePress }
                : {})}
              {...(handleViewAllPress
                ? { onViewAllPress: handleViewAllPress }
                : {})}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
        {...listProps}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={
          listProps?.scrollEventThrottle ?? SCROLL_EVENT_THROTTLE_MS
        }
      />
      <Animated.View
        className="absolute inset-0 bg-dark-slate-blue"
        pointerEvents="none"
        style={{ opacity: coverOpacity }}
        testID="page-rails-scroll-cover"
      />
    </View>
  );
}
