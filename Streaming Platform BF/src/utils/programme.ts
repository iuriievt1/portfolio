import type { ContentItem } from "@bfbs/common-sdk";
import { formatClockTime, parseDateMs } from "@/utils/date-time";

/** Stands in for a programme's title where the schedule has none. */
export const MISSING_PROGRAMME_LABEL = "Programme Info Not Available";

/** Stands in for a programme's synopsis where the schedule has none. */
export const MISSING_PROGRAMME_SYNOPSIS = "Programme info not available.";

/** Shows an all-capitals provider genre in title case, e.g. "ADVENTURE" → "Adventure". Mixed case is kept. */
export function formatGenre(genre: string) {
  const trimmed = genre.trim();

  if (trimmed !== trimmed.toUpperCase()) {
    return trimmed;
  }

  return trimmed
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
}

/** Formats optional season and episode numbers as `S1 E2`. */
export function formatEpisodePosition({
  episodeNumber,
  seasonNumber,
}: {
  episodeNumber?: string | null | undefined;
  seasonNumber?: string | null | undefined;
}): string | undefined {
  const cleanSeasonNumber = seasonNumber?.trim();
  const cleanEpisodeNumber = episodeNumber?.trim();
  const parts = [
    cleanSeasonNumber ? `S${cleanSeasonNumber}` : undefined,
    cleanEpisodeNumber ? `E${cleanEpisodeNumber}` : undefined,
  ].filter((value): value is string => value !== undefined);

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Formats a programme's on-air window as `HH:mm - HH:mm`, empty when unknown. */
export function formatProgrammeRange({
  endsAt,
  startsAt,
  timeZone,
}: {
  endsAt: string | undefined;
  startsAt: string | undefined;
  timeZone?: string | undefined;
}) {
  const startsAtMs = parseDateMs(startsAt);
  const endsAtMs = parseDateMs(endsAt);

  if (startsAtMs === null || endsAtMs === null) {
    return "";
  }

  return `${formatClockTime({
    timeMs: startsAtMs,
    timeZone,
  })} - ${formatClockTime({ timeMs: endsAtMs, timeZone })}`;
}

/** Programme end: the expiry when the feed gives one, else start plus duration. */
export function getProgrammeEndDateTime(programme: ContentItem) {
  if (programme.expirationDateTime) {
    return programme.expirationDateTime;
  }

  const startMs = Date.parse(programme.startDateTime ?? "");
  const durationSeconds =
    programme.streamingDurationSeconds ??
    programme.contentDurationSeconds ??
    programme.durationSeconds;

  if (Number.isNaN(startMs) || !durationSeconds) {
    return undefined;
  }

  return new Date(startMs + durationSeconds * 1000).toISOString();
}

/** On-air window of an SDK programme, deriving its end when the feed omits one. */
export function formatProgrammeOnAirWindow(
  programme: ContentItem,
  timeZone?: string,
) {
  return formatProgrammeRange({
    endsAt: getProgrammeEndDateTime(programme),
    startsAt: programme.startDateTime,
    timeZone,
  });
}
