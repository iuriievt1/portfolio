import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullGuideGrid } from "@/features/full-guide/components/full-guide-grid/full-guide-grid";
import { FullGuideHero } from "@/features/full-guide/components/full-guide-hero/full-guide-hero";
import { FullGuideSkeleton } from "@/features/full-guide/components/full-guide-skeleton/full-guide-skeleton";
import { GuideDaySelector } from "@/features/full-guide/components/guide-day-selector/guide-day-selector";
import { useGuideSchedule } from "@/features/full-guide/hooks/use-guide-schedule";
import { useGuideScroll } from "@/features/full-guide/hooks/use-guide-scroll";
import { useGuideSelection } from "@/features/full-guide/hooks/use-guide-selection";
import { formatDayLabel } from "@/features/full-guide/utils/format-day-label";
import { isCellLive } from "@/features/full-guide/utils/guide-cells";
import {
  getDayIndexAt,
  getTimeOnDay,
} from "@/features/full-guide/utils/guide-days";
import {
  clampOffset,
  getCentredOffset,
  getLookbackStartMs,
  getPixelsPerMinute,
  getTimeAtOffset,
  getTimeline,
  getTimelineWidth,
} from "@/features/full-guide/utils/guide-layout";
import { getGuideMetrics } from "@/features/full-guide/utils/guide-metrics";
import { setWatchedChannelId } from "@/features/live-channels";
import { useListingTimeZone } from "@/features/my-bfbs";
import { useCurrentTime } from "@/hooks/use-current-time";
import { useDeviceLayout } from "@/hooks/use-device-layout";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  ErrorFullScreen,
  errorCodes,
  mapLoadErrorToCode,
  useErrorAction,
} from "@/infra/error";
import { MINUTE_MS } from "@/utils/date-time";

function FullGuideShell({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-dark-slate-blue"
      style={{ paddingTop: insets.top }}
      testID="full-guide-screen"
    >
      {children}
    </View>
  );
}

type FullGuideScreenProps = {
  channelId?: string | undefined;
};

/** The 7-day guide: a fixed hero over the channel grid. */
export function FullGuideScreen({ channelId }: FullGuideScreenProps) {
  const router = useRouter();
  const layout = useDeviceLayout();
  const metrics = getGuideMetrics(layout);
  const nowMs = useCurrentTime(true, MINUTE_MS);
  const timeZone = useListingTimeZone();
  // State, not a ref: the compiler forbids reading a ref during render.
  const [openedAtMs] = useState(nowMs);
  const scroll = useGuideScroll();

  const [visibleDayIndex, setVisibleDayIndex] = useState(0);
  const daySelector = useDisclosure();

  const { channels, days, error, isLoading, refresh } = useGuideSchedule({
    openedAtMs,
    visibleDayIndex,
  });
  const { selectCell, selection } = useGuideSelection({
    channelId,
    channels,
    nowMs,
  });

  const handleBack = () => {
    router.back();
  };

  const handleErrorAction = useErrorAction({
    onCancel: handleBack,
    onRetry: refresh,
  });

  if (isLoading) {
    return (
      <FullGuideShell>
        <FullGuideSkeleton isTablet={layout.isTablet} metrics={metrics} />
      </FullGuideShell>
    );
  }

  if (error || channels.length === 0) {
    return (
      <ErrorFullScreen
        code={error ? mapLoadErrorToCode(error) : errorCodes.contentUnavailable}
        onAction={handleErrorAction}
      />
    );
  }

  const pixelsPerMinute = getPixelsPerMinute(layout.width, metrics);
  const timeline = getTimeline(
    days,
    getLookbackStartMs({ metrics, openedAtMs, pixelsPerMinute }),
  );
  const visibleDay = days[visibleDayIndex];
  const isLive = selection !== null && isCellLive(selection.cell, nowMs);

  const handleScrollTimeChange = (timeMs: number) => {
    const dayIndex = getDayIndexAt(days, timeMs);

    if (dayIndex >= 0 && dayIndex !== visibleDayIndex) {
      setVisibleDayIndex(dayIndex);
    }
  };

  const handleSelectDay = (dayIndex: number) => {
    const day = days[dayIndex];
    daySelector.close();

    if (!day) {
      return;
    }

    const centredMs = getTimeAtOffset({
      offsetX: scroll.readOffset() + layout.width / 2,
      pixelsPerMinute,
      timeline,
    });

    scroll.scrollTo(
      clampOffset({
        offset: getCentredOffset({
          pixelsPerMinute,
          timeMs: getTimeOnDay({ day, timeMs: centredMs }),
          timeline,
          viewportWidth: layout.width,
        }),
        timelineWidth: getTimelineWidth(timeline, pixelsPerMinute),
        viewportWidth: layout.width,
      }),
    );
    setVisibleDayIndex(dayIndex);
  };

  const handleWatchNow = () => {
    if (!selection) {
      return;
    }

    setWatchedChannelId(selection.channel.id);
    router.push({
      params: { channelId: selection.channel.id },
      pathname: "/player/live/[channelId]",
    });
  };

  return (
    <FullGuideShell>
      <FullGuideHero
        isLandscape={layout.isLandscape}
        isLive={isLive}
        isTablet={layout.isTablet}
        metrics={metrics}
        onBack={handleBack}
        onWatchNow={handleWatchNow}
        programme={selection?.cell.programme}
        width={layout.width}
      />

      <View className="flex-1" style={{ paddingTop: metrics.heroGap }}>
        <FullGuideGrid
          channels={channels}
          dayLabel={
            visibleDay
              ? formatDayLabel({
                  dayStartMs: visibleDay.startMs,
                  nowMs,
                  timeZone,
                })
              : ""
          }
          initialChannelId={channelId}
          metrics={metrics}
          nowMs={nowMs}
          onPressDay={daySelector.open}
          onScrollTimeChange={handleScrollTimeChange}
          onSelectCell={selectCell}
          pixelsPerMinute={pixelsPerMinute}
          scroll={scroll}
          selectedCellId={selection?.cell.id}
          selectedChannelId={selection?.channel.id}
          timeline={timeline}
          timeZone={timeZone}
          viewportWidth={layout.width}
        />
      </View>

      <GuideDaySelector
        days={days}
        isVisible={daySelector.isOpen}
        metrics={metrics}
        nowMs={nowMs}
        onDismiss={daySelector.close}
        onSelectDay={handleSelectDay}
        timeZone={timeZone}
        visibleDayIndex={visibleDayIndex}
      />
    </FullGuideShell>
  );
}
