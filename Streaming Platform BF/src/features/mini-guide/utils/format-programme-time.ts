import { formatClockTime, parseDateMs } from "@/utils/date-time";
import { formatEpisodePosition } from "@/utils/programme";
import type { MiniGuideProgramme } from "../types";

export function formatProgrammeTimeRange(
  programme: MiniGuideProgramme,
  timeZone: string | undefined,
) {
  const startsAtMs = parseDateMs(programme.startsAt);

  if (startsAtMs === null) {
    return "";
  }

  const endsAtMs = parseDateMs(programme.endsAt);
  const startLabel = formatClockTime({ timeMs: startsAtMs, timeZone });

  if (endsAtMs === null) {
    return startLabel;
  }

  return `${startLabel} - ${formatClockTime({ timeMs: endsAtMs, timeZone })}`;
}

export function formatProgrammeMetadata(
  programme: MiniGuideProgramme,
  timeZone: string | undefined,
) {
  const timeRange = formatProgrammeTimeRange(programme, timeZone);
  const episode = formatEpisodePosition(programme);

  if (!episode) {
    return timeRange;
  }
  if (!timeRange) {
    return episode;
  }

  return `${timeRange} | ${episode}`;
}

export function getProgrammeProgress(
  programme: MiniGuideProgramme,
  nowMs: number,
) {
  const startsAtMs = parseDateMs(programme.startsAt);
  const endsAtMs = parseDateMs(programme.endsAt);

  if (startsAtMs === null || endsAtMs === null || endsAtMs <= startsAtMs) {
    return 0;
  }

  return Math.min(
    Math.max((nowMs - startsAtMs) / (endsAtMs - startsAtMs), 0),
    1,
  );
}
