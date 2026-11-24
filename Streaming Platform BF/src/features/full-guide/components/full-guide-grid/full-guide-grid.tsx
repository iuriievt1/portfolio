import { useFocusEffect } from "expo-router";
import { startTransition, useRef, useState } from "react";
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native";
import { GuideChannelColumn } from "@/features/full-guide/components/guide-channel-column/guide-channel-column";
import { GuideChannelRow } from "@/features/full-guide/components/guide-channel-row/guide-channel-row";
import { GuideRowSkeleton } from "@/features/full-guide/components/guide-channel-row/guide-row-skeleton";
import { GuideDayCorner } from "@/features/full-guide/components/guide-day-corner/guide-day-corner";
import {
  GuideTimelineTrack,
  GuideWindowContext,
} from "@/features/full-guide/components/guide-timeline-track/guide-timeline-track";
import type { GuideScroll } from "@/features/full-guide/hooks/use-guide-scroll";
import type { GuideChannel } from "@/features/full-guide/types";
import { findCellById } from "@/features/full-guide/utils/guide-cells";
import {
  clampOffset,
  type GuideHeading,
  type GuideRowSpan,
  type GuideTimeline,
  getMountedRows,
  getOffsetForTime,
  getOpeningOffset,
  getReachableWidth,
  getRowOffset,
  getSelectionOffset,
  getSkeletonRows,
  getTimeAtOffset,
  getTimelineWidth,
  getTrackedRows,
  MIN_SCROLL_SHIFT,
} from "@/features/full-guide/utils/guide-layout";
import {
  type GuideMetrics,
  getRowHeight,
} from "@/features/full-guide/utils/guide-metrics";
import { useWatchedChannelId } from "@/features/live-channels";
import { getDeviceTimeZone } from "@/utils/date-time";

const SCROLL_EVENT_THROTTLE_MS = 16;
const WINDOW_REANCHOR_SCREENS = 1;
/** The rows drawn before the list has measured itself. */
const INITIAL_ROWS: GuideRowSpan = { first: 0, last: 10 };

function isSameSpan(left: GuideRowSpan, right: GuideRowSpan) {
  return left.first === right.first && left.last === right.last;
}

function isInSpan(index: number, { first, last }: GuideRowSpan) {
  return index >= first && index <= last;
}

type FullGuideGridProps = {
  channels: GuideChannel[];
  dayLabel: string;
  initialChannelId?: string | undefined;
  metrics: GuideMetrics;
  nowMs: number;
  onPressDay: () => void;
  onScrollTimeChange: (timeMs: number) => void;
  onSelectCell: (cellId: string) => void;
  pixelsPerMinute: number;
  scroll: GuideScroll;
  selectedCellId: string | undefined;
  /** The row the selection sits on; only that row redraws when a pick moves within it. */
  selectedChannelId: string | undefined;
  timeline: GuideTimeline;
  timeZone?: string;
  viewportWidth: number;
};

/**
 * The channel table. One vertical scroll carries the fixed channel column beside a single horizontal timeline of
 * rows, so the tiles move with their rows as plain content and never sideways. Rows are virtualized both ways.
 */
export function FullGuideGrid({
  channels,
  dayLabel,
  initialChannelId,
  metrics,
  nowMs,
  onPressDay,
  onScrollTimeChange,
  onSelectCell,
  pixelsPerMinute,
  scroll,
  selectedCellId,
  selectedChannelId,
  timeline,
  timeZone = getDeviceTimeZone(),
  viewportWidth,
}: FullGuideGridProps) {
  const { follow, readOffset, scrollOffset, scrollRef, scrollTo, settle } =
    scroll;
  const timelineWidth = getTimelineWidth(timeline, pixelsPerMinute);
  const rowHeight = getRowHeight(metrics);
  const listHeight = rowHeight * channels.length;
  const openingX = getOpeningOffset({
    metrics,
    nowMs,
    pixelsPerMinute,
    timeline,
    timelineWidth,
    viewportWidth,
  });

  const rowsRef = useRef<ScrollView | null>(null);
  const hasOpenedRef = useRef(false);
  const rowsOffsetRef = useRef(0);
  const rowsHeightRef = useRef(0);
  const scaleRef = useRef({ pixelsPerMinute, timeline });
  const [gridHeight, setGridHeight] = useState(0);
  // Rows on screen re-anchor as the timeline moves; the rest catch up once it rests, so a fling only ever
  // mounts cards for the rows a viewer can see.
  const [{ heading, x: renderWindowX }, setRenderWindow] = useState<{
    heading: GuideHeading;
    x: number;
  }>({ heading: 0, x: openingX });
  const [restingWindowX, setRestingWindowX] = useState(openingX);
  const [isMoving, setIsMoving] = useState(false);
  // Mirrors isMoving for the scroll listener, which must not wait on a render to know a finger is down.
  const isMovingRef = useRef(false);
  const renderWindowRef = useRef(openingX);
  const [trackedRows, setTrackedRows] = useState(INITIAL_ROWS);
  // Rows near the viewport mount their cards; a wider reach either side holds skeletons, so a fast vertical
  // fling meets placeholders rather than empty rows while the cards catch up.
  const [mountedRows, setMountedRows] = useState<{
    cards: GuideRowSpan;
    skeletons: GuideRowSpan;
  }>({ cards: INITIAL_ROWS, skeletons: INITIAL_ROWS });
  const mountedRowsRef = useRef(mountedRows);
  const watchedChannelId = useWatchedChannelId();
  const shownWatchedChannelIdRef = useRef(watchedChannelId);

  const anchorAt = (offsetX: number, { isResting = true } = {}) => {
    const travelled = offsetX - renderWindowRef.current;
    renderWindowRef.current = offsetX;
    setRenderWindow({
      heading: isResting ? 0 : (Math.sign(travelled) as GuideHeading),
      x: offsetX,
    });

    if (isResting) {
      // A transition yields to scroll events, so the rows off screen never hold up the next gesture.
      startTransition(() => {
        setRestingWindowX(offsetX);
      });
    }
  };

  const trackRowsAt = (offsetY: number) => {
    setTrackedRows(
      getTrackedRows({
        listHeight: rowsHeightRef.current,
        offsetY,
        rowHeight,
      }),
    );
  };

  const mountRowsAt = (offsetY: number) => {
    const span = {
      listHeight: rowsHeightRef.current,
      offsetY,
      rowCount: channels.length,
      rowHeight,
    };
    const next = {
      cards: getMountedRows(span),
      skeletons: getSkeletonRows(span),
    };
    const current = mountedRowsRef.current;

    if (
      !(
        isSameSpan(next.cards, current.cards) &&
        isSameSpan(next.skeletons, current.skeletons)
      )
    ) {
      mountedRowsRef.current = next;
      setMountedRows(next);
    }
  };

  const getTimeAtCentre = (offsetX: number) =>
    getTimeAtOffset({
      offsetX: offsetX + viewportWidth / 2,
      pixelsPerMinute,
      timeline,
    });

  const handleContentSizeChange = () => {
    const previous = scaleRef.current;
    scaleRef.current = { pixelsPerMinute, timeline };

    if (
      !hasOpenedRef.current ||
      (previous.pixelsPerMinute === pixelsPerMinute &&
        previous.timeline.startMs === timeline.startMs)
    ) {
      return;
    }

    const keptMs = getTimeAtOffset({
      offsetX: readOffset(),
      pixelsPerMinute: previous.pixelsPerMinute,
      timeline: previous.timeline,
    });
    const offset = clampOffset({
      offset: getOffsetForTime({ pixelsPerMinute, timeMs: keptMs, timeline }),
      timelineWidth,
      viewportWidth,
    });

    scrollTo(offset);
    anchorAt(offset);
    onScrollTimeChange(getTimeAtCentre(offset));
  };

  const showRow = (index: number, { animated }: { animated: boolean }) => {
    if (index < 0) {
      return;
    }

    const offset = getRowOffset({
      index,
      listHeight: rowsHeightRef.current,
      offsetY: rowsOffsetRef.current,
      rowCount: channels.length,
      rowHeight,
    });

    if (offset !== null) {
      rowsOffsetRef.current = offset;
      mountRowsAt(offset);
      trackRowsAt(offset);
      rowsRef.current?.scrollTo({ animated, y: offset });
    }
  };

  const handleRowsLayout = (event: LayoutChangeEvent) => {
    rowsHeightRef.current = event.nativeEvent.layout.height;

    mountRowsAt(rowsOffsetRef.current);
    trackRowsAt(rowsOffsetRef.current);

    if (hasOpenedRef.current || channels.length === 0) {
      return;
    }

    hasOpenedRef.current = true;
    scrollTo(openingX);
    showRow(
      channels.findIndex((channel) => channel.id === initialChannelId),
      { animated: false },
    );
  };

  // Back from the player on another channel: bring its row into view.
  useFocusEffect(() => {
    if (watchedChannelId === shownWatchedChannelIdRef.current) {
      return;
    }

    shownWatchedChannelIdRef.current = watchedChannelId;
    showRow(
      channels.findIndex((channel) => channel.id === watchedChannelId),
      { animated: true },
    );
  });

  const handleSelectCell = (cellId: string) => {
    onSelectCell(cellId);

    const found = findCellById(channels, cellId);

    if (!found) {
      return;
    }

    const offset = getSelectionOffset({
      cell: found.cell,
      metrics,
      nowMs,
      offsetX: readOffset(),
      pixelsPerMinute,
      timeline,
      timelineWidth,
      viewportWidth,
    });

    if (Math.abs(offset - readOffset()) >= MIN_SCROLL_SHIFT) {
      scrollTo(offset, { animated: true });
      anchorAt(offset);
    }

    showRow(
      channels.findIndex((channel) => channel.id === found.channel.id),
      { animated: true },
    );
  };

  const handleScrollBeginDrag = () => {
    isMovingRef.current = true;
    setIsMoving(true);
  };

  const handleScrollSettled = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    settle(offsetX);
    isMovingRef.current = false;
    setIsMoving(false);
    anchorAt(offsetX);
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!event.nativeEvent.velocity?.x) {
      handleScrollSettled(event);
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollOffset } } }],
    {
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;

        follow(offsetX);
        onScrollTimeChange(getTimeAtCentre(offsetX));

        if (
          Math.abs(offsetX - renderWindowRef.current) >=
          viewportWidth * WINDOW_REANCHOR_SCREENS
        ) {
          // With no finger or momentum under it, this is a jump made in code (the day picker) that nothing
          // settles afterwards, so it anchors at rest instead of leaning the window towards a fling.
          anchorAt(offsetX, { isResting: !isMovingRef.current });
        }
      },
      useNativeDriver: true,
    },
  );

  const handleRowsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    rowsOffsetRef.current = offsetY;
    mountRowsAt(offsetY);
  };

  // Rows off screen draw their text still, which is exact while the timeline rests, so the tracked rows only
  // need to catch up once the rows stop.
  const handleRowsSettled = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    trackRowsAt(event.nativeEvent.contentOffset.y);
  };

  const handleRowsEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    if (!event.nativeEvent.velocity?.y) {
      handleRowsSettled(event);
    }
  };

  const { cards: cardRows, skeletons: skeletonRows } = mountedRows;
  const mounted = channels
    .slice(skeletonRows.first, skeletonRows.last + 1)
    .map((channel, offset) => {
      const index = skeletonRows.first + offset;

      return {
        channel,
        hasCards: isInSpan(index, cardRows),
        index,
        isTracked: isInSpan(index, trackedRows),
      };
    });

  return (
    <View
      className="flex-1 overflow-hidden"
      onLayout={(event) => setGridHeight(event.nativeEvent.layout.height)}
      testID="full-guide-grid"
    >
      <ScrollView
        bounces={false}
        onLayout={handleRowsLayout}
        onMomentumScrollEnd={handleRowsSettled}
        onScroll={handleRowsScroll}
        onScrollEndDrag={handleRowsEndDrag}
        ref={rowsRef}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
        showsVerticalScrollIndicator={false}
        style={{ marginTop: metrics.headerHeight }}
        testID="full-guide-channels"
      >
        <View style={{ height: listHeight }}>
          <Animated.ScrollView
            bounces={false}
            horizontal
            onContentSizeChange={handleContentSizeChange}
            onMomentumScrollEnd={handleScrollSettled}
            onScroll={handleScroll}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            ref={scrollRef}
            scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
            showsHorizontalScrollIndicator={false}
            testID="full-guide-timeline"
          >
            <View
              // While a finger drives the timeline it can only run as far as the skeletons reach, and the reach
              // grows as the window re-anchors. At rest it spans the week, so a jump to any day is never cut short.
              style={{
                height: listHeight,
                width: isMoving
                  ? getReachableWidth({
                      scrollX: renderWindowX,
                      timelineWidth,
                      viewportWidth,
                    })
                  : timelineWidth,
              }}
              testID="full-guide-timeline-content"
            >
              {mounted.map(({ channel, hasCards, index, isTracked }) => (
                <View
                  key={channel.id}
                  style={{
                    left: 0,
                    position: "absolute",
                    top: index * rowHeight,
                  }}
                  testID={`guide-row-slot-${channel.id}`}
                >
                  {hasCards ? (
                    <GuideChannelRow
                      channel={channel}
                      heading={isTracked ? heading : 0}
                      isTracking={isTracked}
                      metrics={metrics}
                      nowMs={nowMs}
                      onSelectCell={handleSelectCell}
                      pixelsPerMinute={pixelsPerMinute}
                      scroll={scroll}
                      scrollX={isTracked ? renderWindowX : restingWindowX}
                      selectedCellId={
                        channel.id === selectedChannelId
                          ? selectedCellId
                          : undefined
                      }
                      timeline={timeline}
                      timeZone={timeZone}
                      viewportWidth={viewportWidth}
                      width={timelineWidth}
                    />
                  ) : (
                    <GuideRowSkeleton
                      channel={channel}
                      metrics={metrics}
                      pixelsPerMinute={pixelsPerMinute}
                      scrollX={restingWindowX}
                      timeline={timeline}
                      viewportWidth={viewportWidth}
                      width={timelineWidth}
                    />
                  )}
                </View>
              ))}
            </View>
          </Animated.ScrollView>

          <GuideChannelColumn channels={channels} metrics={metrics} />
        </View>
      </ScrollView>

      <GuideWindowContext value={renderWindowX}>
        <GuideTimelineTrack
          height={gridHeight}
          metrics={metrics}
          nowMs={nowMs}
          pixelsPerMinute={pixelsPerMinute}
          scrollOffset={scrollOffset}
          timeline={timeline}
          timeZone={timeZone}
          viewportWidth={viewportWidth}
          width={timelineWidth}
        />
      </GuideWindowContext>

      <GuideDayCorner
        dayLabel={dayLabel}
        metrics={metrics}
        onPressDay={onPressDay}
      />
    </View>
  );
}
