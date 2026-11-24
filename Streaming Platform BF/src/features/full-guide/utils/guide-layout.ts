import type { Animated } from "react-native";
import type { GuideCell, GuideDay } from "@/features/full-guide/types";
import { isCellLive } from "@/features/full-guide/utils/guide-cells";
import {
  type GuideMetrics,
  getColumnWidth,
} from "@/features/full-guide/utils/guide-metrics";
import { MINUTE_MS } from "@/utils/date-time";
import { clamp } from "@/utils/number";

/** A move shorter than a point is not worth scrolling for. */
export const MIN_SCROLL_SHIFT = 1;

/** How far back a viewer can look: half an hour behind the moment the guide opened. */
export const LOOKBACK_MS = 30 * MINUTE_MS;

const MIN_CELL_WIDTH = 8;
const FADE_DISTANCE = 20;
const MINUTES_ON_SCREEN = 60;
const ROWS_IN_HAND = 1;
const HORIZONTAL_OVERSCAN_SCREENS = 1;
/** While the timeline moves, how much of the window stays behind it; the rest runs ahead. */
const TRAILING_SCREENS = 0.5;
const TRACKING_SCREENS = 2;
/** How far skeletons reach either side of the viewport, so a fling outrunning the cards meets placeholders. */
const SKELETON_SCREENS = 4;
/** How many screens of rows either side hold skeletons, so a fast vertical fling meets placeholders. */
const SKELETON_ROW_SCREENS = 4;

/** Which way the timeline last moved: -1 back in time, 1 forward, 0 at rest. */
export type GuideHeading = -1 | 0 | 1;

export type GuideTimeline = {
  endMs: number;
  startMs: number;
};

/** An interpolation that holds its end values beyond the input range. */
export function clamped({
  inputRange,
  outputRange,
}: {
  inputRange: number[];
  outputRange: number[];
}): Animated.InterpolationConfigType {
  return { extrapolate: "clamp", inputRange, outputRange };
}

/** Fades a label out before it would slide under the pinned column. */
export function getPinnedFadeRange(left: number, metrics: GuideMetrics) {
  const columnWidth = getColumnWidth(metrics);

  return clamped({
    inputRange: [left - columnWidth - FADE_DISTANCE, left - columnWidth],
    outputRange: [1, 0],
  });
}

/** The scale the grid is drawn at: an hour fills the strip beside the column. */
export function getPixelsPerMinute(
  viewportWidth: number,
  metrics: GuideMetrics,
) {
  return (viewportWidth - getColumnWidth(metrics)) / MINUTES_ON_SCREEN;
}

/** Where the week begins so the strip's edge can reach half an hour back. */
export function getLookbackStartMs({
  metrics,
  openedAtMs,
  pixelsPerMinute,
}: {
  metrics: GuideMetrics;
  openedAtMs: number;
  pixelsPerMinute: number;
}) {
  return (
    openedAtMs -
    LOOKBACK_MS -
    (getColumnWidth(metrics) / pixelsPerMinute) * MINUTE_MS
  );
}

/** The week the guide scrolls as one, from a moment to the end of its last day. */
export function getTimeline(days: GuideDay[], fromMs: number): GuideTimeline {
  return {
    endMs: days.at(-1)?.endMs ?? 0,
    startMs: Math.max(days[0]?.startMs ?? 0, fromMs),
  };
}

/** How wide the week is at that scale. */
export function getTimelineWidth(
  timeline: GuideTimeline,
  pixelsPerMinute: number,
) {
  return ((timeline.endMs - timeline.startMs) / MINUTE_MS) * pixelsPerMinute;
}

/** Where a moment sits along the timeline. */
export function getOffsetForTime({
  pixelsPerMinute,
  timeMs,
  timeline,
}: {
  pixelsPerMinute: number;
  timeMs: number;
  timeline: GuideTimeline;
}) {
  return ((timeMs - timeline.startMs) / MINUTE_MS) * pixelsPerMinute;
}

/** The moment that sits at an offset along the timeline. */
export function getTimeAtOffset({
  offsetX,
  pixelsPerMinute,
  timeline,
}: {
  offsetX: number;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
}) {
  return timeline.startMs + (offsetX / pixelsPerMinute) * MINUTE_MS;
}

/** The offset that puts a moment in the middle of the viewport. */
export function getCentredOffset({
  pixelsPerMinute,
  timeMs,
  timeline,
  viewportWidth,
}: {
  pixelsPerMinute: number;
  timeMs: number;
  timeline: GuideTimeline;
  viewportWidth: number;
}) {
  return (
    getOffsetForTime({ pixelsPerMinute, timeMs, timeline }) - viewportWidth / 2
  );
}

/** The stretch worth drawing, with enough runway for a fast native fling. */
export function getRenderWindow({
  heading = 0,
  scrollX,
  viewportWidth,
}: {
  heading?: GuideHeading;
  scrollX: number;
  viewportWidth: number;
}) {
  const leading =
    heading === 0
      ? HORIZONTAL_OVERSCAN_SCREENS
      : HORIZONTAL_OVERSCAN_SCREENS * 2 - TRAILING_SCREENS;
  const trailing =
    heading === 0 ? HORIZONTAL_OVERSCAN_SCREENS : TRAILING_SCREENS;
  const behind = heading < 0 ? leading : trailing;
  const ahead = heading < 0 ? trailing : leading;

  return {
    fromX: scrollX - viewportWidth * behind,
    toX: scrollX + viewportWidth * (ahead + 1),
  };
}

/** Cells keep their real times, clipped to the week the grid draws. */
export function getCellLayout({
  cell,
  metrics,
  pixelsPerMinute,
  timeline,
}: {
  cell: GuideCell;
  metrics: GuideMetrics;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
}) {
  const startMs = Math.max(cell.startMs, timeline.startMs);
  const endMs = Math.min(cell.endMs, timeline.endMs);
  const left = getOffsetForTime({ pixelsPerMinute, timeMs: startMs, timeline });
  const width =
    ((endMs - startMs) / MINUTE_MS) * pixelsPerMinute - metrics.cellGap;

  return { left, width };
}

/** How much of a card sits under the pinned column at an offset, so its text can start clear of it. */
export function getHiddenWidth({
  layout,
  metrics,
  scrollX,
}: {
  layout: { left: number; width: number };
  metrics: GuideMetrics;
  scrollX: number;
}) {
  return clamp({
    max: layout.width,
    min: 0,
    value: scrollX - (layout.left - getColumnWidth(metrics)),
  });
}

/** Whether a card can reach the column before the window next re-anchors, so its text must follow the native scroll. */
export function isNearColumn({
  layout,
  metrics,
  scrollX,
  viewportWidth,
}: {
  layout: { left: number; width: number };
  metrics: GuideMetrics;
  scrollX: number;
  viewportWidth: number;
}) {
  const reach = viewportWidth * TRACKING_SCREENS;
  const hiddenAt = layout.left - getColumnWidth(metrics);

  return (
    hiddenAt <= scrollX + reach && hiddenAt + layout.width >= scrollX - reach
  );
}

export type GuideCellWithLayout = {
  cell: GuideCell;
  layout: ReturnType<typeof getCellLayout>;
};

/** Calculates stable cell geometry when a row's schedule or scale changes. */
export function layoutGuideCells({
  cells,
  metrics,
  pixelsPerMinute,
  timeline,
}: {
  cells: GuideCell[];
  metrics: GuideMetrics;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
}): GuideCellWithLayout[] {
  return cells
    .map((cell) => ({
      cell,
      layout: getCellLayout({ cell, metrics, pixelsPerMinute, timeline }),
    }))
    .filter(({ layout }) => layout.width >= MIN_CELL_WIDTH)
    .sort((left, right) => left.layout.left - right.layout.left);
}

/** The index span of sorted cells reaching into a stretch of the timeline, end exclusive. */
function getCellSpan(
  cells: GuideCellWithLayout[],
  { fromX, toX }: { fromX: number; toX: number },
) {
  let start = 0;
  let high = cells.length;

  while (start < high) {
    const middle = Math.floor((start + high) / 2);
    const candidate = cells[middle];

    if (candidate && candidate.layout.left + candidate.layout.width < fromX) {
      start = middle + 1;
    } else {
      high = middle;
    }
  }

  let end = start;

  while (end < cells.length && (cells[end]?.layout.left ?? 0) <= toX) {
    end += 1;
  }

  return { end, start };
}

/** The stretch skeletons cover around an offset; the one owner of how far placeholders reach. */
function getSkeletonReach(scrollX: number, viewportWidth: number) {
  return {
    fromX: scrollX - viewportWidth * SKELETON_SCREENS,
    toX: scrollX + viewportWidth * (SKELETON_SCREENS + 1),
  };
}

/** How far a moving timeline may run: to the last skeleton, so a fling can never outrun what is drawn. */
export function getReachableWidth({
  scrollX,
  timelineWidth,
  viewportWidth,
}: {
  scrollX: number;
  timelineWidth: number;
  viewportWidth: number;
}) {
  return Math.min(timelineWidth, getSkeletonReach(scrollX, viewportWidth).toX);
}

/** Selects the already-laid-out cells intersecting the buffered viewport. */
export function getVisibleCellLayouts({
  cells,
  heading = 0,
  scrollX,
  viewportWidth,
}: {
  cells: GuideCellWithLayout[];
  heading?: GuideHeading;
  scrollX: number;
  viewportWidth: number;
}): GuideCellWithLayout[] {
  const { end, start } = getCellSpan(
    cells,
    getRenderWindow({ heading, scrollX, viewportWidth }),
  );

  return cells.slice(start, end);
}

/** The cells either side of the drawn ones, out to a wider stretch, that hold their place as skeletons. */
export function getSkeletonCellLayouts({
  cells,
  heading = 0,
  scrollX,
  viewportWidth,
}: {
  cells: GuideCellWithLayout[];
  heading?: GuideHeading;
  scrollX: number;
  viewportWidth: number;
}): GuideCellWithLayout[] {
  const drawn = getCellSpan(
    cells,
    getRenderWindow({ heading, scrollX, viewportWidth }),
  );
  const reach = getCellSpan(cells, getSkeletonReach(scrollX, viewportWidth));

  return [
    ...cells.slice(reach.start, Math.max(drawn.start, reach.start)),
    ...cells.slice(Math.min(drawn.end, reach.end), reach.end),
  ];
}

/** The cells worth drawing, each with its place on the timeline. */
export function getVisibleCells({
  cells,
  metrics,
  pixelsPerMinute,
  scrollX,
  timeline,
  viewportWidth,
}: {
  cells: GuideCell[];
  metrics: GuideMetrics;
  pixelsPerMinute: number;
  scrollX: number;
  timeline: GuideTimeline;
  viewportWidth: number;
}) {
  return getVisibleCellLayouts({
    cells: layoutGuideCells({ cells, metrics, pixelsPerMinute, timeline }),
    scrollX,
    viewportWidth,
  });
}

/** The scroll positions the timeline can hold, from its start to its last screen. */
export function clampOffset({
  offset,
  timelineWidth,
  viewportWidth,
}: {
  offset: number;
  timelineWidth: number;
  viewportWidth: number;
}) {
  return clamp({
    max: Math.max(timelineWidth - viewportWidth, 0),
    min: 0,
    value: offset,
  });
}

/** Opens on the live edge: now at the strip's start, led by half the live clock. */
export function getOpeningOffset({
  metrics,
  nowMs,
  pixelsPerMinute,
  timeline,
  timelineWidth,
  viewportWidth,
}: {
  metrics: GuideMetrics;
  nowMs: number;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
  timelineWidth: number;
  viewportWidth: number;
}) {
  const lead = metrics.clockWidth / 2 + FADE_DISTANCE;

  return clampOffset({
    offset:
      getOffsetForTime({ pixelsPerMinute, timeMs: nowMs, timeline }) -
      getColumnWidth(metrics) -
      lead,
    timelineWidth,
    viewportWidth,
  });
}

/** Where a pick settles the timeline: the live edge when on air, else the card's start within one strip. */
export function getSelectionOffset({
  cell,
  metrics,
  nowMs,
  offsetX,
  pixelsPerMinute,
  timeline,
  timelineWidth,
  viewportWidth,
}: {
  cell: GuideCell;
  metrics: GuideMetrics;
  nowMs: number;
  offsetX: number;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
  timelineWidth: number;
  viewportWidth: number;
}) {
  if (isCellLive(cell, nowMs)) {
    return getOpeningOffset({
      metrics,
      nowMs,
      pixelsPerMinute,
      timeline,
      timelineWidth,
      viewportWidth,
    });
  }

  const columnWidth = getColumnWidth(metrics);
  const start = clampOffset({
    offset:
      getOffsetForTime({ pixelsPerMinute, timeMs: cell.startMs, timeline }) -
      columnWidth,
    timelineWidth,
    viewportWidth,
  });
  const reach = viewportWidth - columnWidth;

  return Math.abs(start - offsetX) <= reach ? start : offsetX;
}

export type GuideRowSpan = {
  first: number;
  last: number;
};

/** The visible rows, and one either side, whose cards follow the native scroll. */
export function getTrackedRows({
  listHeight,
  offsetY,
  rowHeight,
}: {
  listHeight: number;
  offsetY: number;
  rowHeight: number;
}): GuideRowSpan {
  const first = Math.floor(offsetY / rowHeight);
  const last = Math.ceil((offsetY + listHeight) / rowHeight) - 1;

  return { first: first - ROWS_IN_HAND, last: last + ROWS_IN_HAND };
}

/** The rows worth mounting: those on screen and a few screens' worth either side, within the list. */
export function getMountedRows({
  listHeight,
  offsetY,
  rowCount,
  rowHeight,
  screens = 1,
}: {
  listHeight: number;
  offsetY: number;
  rowCount: number;
  rowHeight: number;
  screens?: number;
}): GuideRowSpan {
  const visible = Math.max(Math.ceil(listHeight / rowHeight), 1);
  const first = Math.floor(offsetY / rowHeight);

  return {
    first: Math.max(first - visible * screens, 0),
    last: Math.min(first + visible * (screens + 1), rowCount - 1),
  };
}

/** The rows that hold skeletons beyond the mounted ones, out to a wider reach either side. */
export function getSkeletonRows(params: {
  listHeight: number;
  offsetY: number;
  rowCount: number;
  rowHeight: number;
}): GuideRowSpan {
  return getMountedRows({ ...params, screens: SKELETON_ROW_SCREENS });
}

/** The already-laid-out cells reaching into the viewport alone, for placeholders that only need to fill it. */
export function getOnScreenCellLayouts({
  cells,
  scrollX,
  viewportWidth,
}: {
  cells: GuideCellWithLayout[];
  scrollX: number;
  viewportWidth: number;
}): GuideCellWithLayout[] {
  const { end, start } = getCellSpan(cells, {
    fromX: scrollX,
    toX: scrollX + viewportWidth,
  });

  return cells.slice(start, end);
}

/** The vertical offset that shows a picked row with a row either side, moving least. */
export function getRowOffset({
  index,
  listHeight,
  offsetY,
  rowCount,
  rowHeight,
}: {
  index: number;
  listHeight: number;
  offsetY: number;
  rowCount: number;
  rowHeight: number;
}) {
  const above = (index - ROWS_IN_HAND) * rowHeight;
  const below = (index + 1 + ROWS_IN_HAND) * rowHeight;

  const moveTo = (wanted: number) => {
    const offset = clamp({
      max: Math.max(rowCount * rowHeight - listHeight, 0),
      min: 0,
      value: wanted,
    });

    return Math.abs(offset - offsetY) < MIN_SCROLL_SHIFT ? null : offset;
  };

  if (above < offsetY) {
    return moveTo(above);
  }

  if (below > offsetY + listHeight) {
    return moveTo(below - listHeight);
  }

  return null;
}
