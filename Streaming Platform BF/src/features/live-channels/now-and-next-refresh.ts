import type { ContentItem } from "@bfbs/common-sdk";
import { parseDateMs } from "@/utils/date-time";

export const NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS = 60_000;
export const NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS = 1000;

function getProgrammeStartTimeMs(programme: ContentItem | undefined) {
  return parseDateMs(programme?.startDateTime);
}

function getProgrammeEndTimeMs(programme: ContentItem | undefined) {
  const explicitEndMs = parseDateMs(programme?.expirationDateTime);

  if (explicitEndMs !== null) {
    return explicitEndMs;
  }

  const startTimeMs = getProgrammeStartTimeMs(programme);
  const durationSeconds =
    programme?.streamingDurationSeconds ??
    programme?.contentDurationSeconds ??
    programme?.durationSeconds;

  if (startTimeMs === null || durationSeconds === undefined) {
    return null;
  }

  return startTimeMs + durationSeconds * 1000;
}

function isCurrentProgramme(programme: ContentItem, nowMs: number) {
  const startTimeMs = getProgrammeStartTimeMs(programme);
  const endTimeMs = getProgrammeEndTimeMs(programme);

  return (
    startTimeMs !== null &&
    endTimeMs !== null &&
    startTimeMs <= nowMs &&
    (startTimeMs === endTimeMs ? nowMs === startTimeMs : nowMs < endTimeMs)
  );
}

function getCurrentProgrammeWithFallback(
  programmes: readonly ContentItem[],
  nowMs: number,
) {
  return (
    programmes.find((programme) => isCurrentProgramme(programme, nowMs)) ??
    programmes[0]
  );
}

/**
 * Calculates how long to wait before the next now-and-next metadata refresh.
 */
export function getBoundaryRefreshIntervalMs(
  nextBoundaryMs: number | null | undefined,
  nowMs = Date.now(),
) {
  if (
    nextBoundaryMs === null ||
    nextBoundaryMs === undefined ||
    nextBoundaryMs <= nowMs
  ) {
    return NOW_AND_NEXT_FALLBACK_REFRESH_INTERVAL_MS;
  }

  return Math.max(nextBoundaryMs - nowMs, NOW_AND_NEXT_MIN_REFRESH_INTERVAL_MS);
}

/**
 * Checks whether the supplied programme boundary has already passed.
 */
export function shouldRefreshAtBoundary(
  nextBoundaryMs: number | null | undefined,
  nowMs = Date.now(),
) {
  return nextBoundaryMs !== null && nextBoundaryMs !== undefined
    ? nextBoundaryMs <= nowMs
    : false;
}

/** Waits until the earliest future current-programme end across all channels. */
export function getProgrammeGuideRefetchDelayMs(
  guide: { channels: { programmes: ContentItem[] }[] } | undefined,
  nowMs = Date.now(),
) {
  let earliestBoundaryMs: number | null = null;

  for (const guideChannel of guide?.channels ?? []) {
    const currentProgramme = getCurrentProgrammeWithFallback(
      guideChannel.programmes,
      nowMs,
    );
    const boundaryMs = getProgrammeEndTimeMs(currentProgramme);

    if (
      boundaryMs !== null &&
      boundaryMs > nowMs &&
      (earliestBoundaryMs === null || boundaryMs < earliestBoundaryMs)
    ) {
      earliestBoundaryMs = boundaryMs;
    }
  }

  return getBoundaryRefreshIntervalMs(earliestBoundaryMs, nowMs);
}
