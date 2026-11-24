import { useMemo } from "react";
import type { GuideChannel } from "@/features/full-guide/types";
import {
  type GuideTimeline,
  layoutGuideCells,
} from "@/features/full-guide/utils/guide-layout";
import type { GuideMetrics } from "@/features/full-guide/utils/guide-metrics";

/**
 * A channel's cells placed on the timeline, kept while its schedule and the scale hold, so a row only lays out
 * its week again when either changes rather than on every scroll.
 */
export function useLaidOutCells({
  channel,
  metrics,
  pixelsPerMinute,
  timeline,
}: {
  channel: GuideChannel;
  metrics: GuideMetrics;
  pixelsPerMinute: number;
  timeline: GuideTimeline;
}) {
  const { cells } = channel;

  return useMemo(
    () => layoutGuideCells({ cells, metrics, pixelsPerMinute, timeline }),
    [cells, metrics, pixelsPerMinute, timeline],
  );
}
