import {
  type GuideTimeline,
  getRenderWindow,
  getTimeAtOffset,
} from "@/features/full-guide/utils/guide-layout";
import { MINUTE_MS, startOfDay } from "@/utils/date-time";

const RULER_STEP_MS = 30 * MINUTE_MS;

/** The half-hour marks worth drawing, on the local clock, around the viewport. */
export function getRulerMarks({
  pixelsPerMinute,
  scrollX,
  timeline,
  viewportWidth,
}: {
  pixelsPerMinute: number;
  scrollX: number;
  timeline: GuideTimeline;
  viewportWidth: number;
}) {
  const { fromX, toX } = getRenderWindow({ scrollX, viewportWidth });
  const anchorMs = startOfDay(timeline.startMs);
  const fromMs = Math.max(
    getTimeAtOffset({ offsetX: fromX, pixelsPerMinute, timeline }),
    timeline.startMs,
  );
  const toMs = Math.min(
    getTimeAtOffset({ offsetX: toX, pixelsPerMinute, timeline }),
    timeline.endMs,
  );
  const stepsToFirstMark = Math.ceil((fromMs - anchorMs) / RULER_STEP_MS);
  const firstMarkMs = anchorMs + stepsToFirstMark * RULER_STEP_MS;
  const markCount = Math.max(
    Math.floor((toMs - firstMarkMs) / RULER_STEP_MS) + 1,
    0,
  );

  return Array.from(
    { length: markCount },
    (_mark, index) => firstMarkMs + index * RULER_STEP_MS,
  );
}

/** Whether a mark would print under the live clock, which is the same width. */
export function isUnderLiveClock({
  clockLeft,
  clockWidth,
  markLeft,
}: {
  clockLeft: number;
  clockWidth: number;
  markLeft: number;
}) {
  return (
    markLeft < clockLeft + clockWidth / 2 &&
    markLeft + clockWidth > clockLeft - clockWidth / 2
  );
}
