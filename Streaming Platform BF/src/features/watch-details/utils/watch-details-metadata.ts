import type { ContentItem, ContentParentalRating } from "@bfbs/common-sdk";
import { getContentDurationSeconds } from "@/features/content-rails/content";
import { formatDateAtTime, parseDateMs } from "@/utils/date-time";

const LEAVING_SOON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export function formatRuntime(
  durationSeconds: number | undefined,
): string | undefined {
  if (
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return undefined;
  }

  const totalMinutes = Math.floor(durationSeconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export function getAssetMetadataItems(
  asset: Pick<
    ContentItem,
    | "genres"
    | "productionYear"
    | "durationSeconds"
    | "contentDurationSeconds"
    | "streamingDurationSeconds"
  >,
): string[] {
  const genre = asset.genres?.[0];
  const year =
    typeof asset.productionYear === "number"
      ? String(asset.productionYear)
      : undefined;
  const runtime = formatRuntime(getContentDurationSeconds(asset));

  return [genre, year, runtime].filter(
    (item): item is string => item !== undefined && item.length > 0,
  );
}

export function getSynopsis(
  asset: Pick<ContentItem, "synopsis" | "longSynopsis" | "description">,
): string | undefined {
  return asset.synopsis ?? asset.longSynopsis ?? asset.description;
}

export function isLeavingSoon({
  expirationDateTime,
  nowMs,
}: {
  expirationDateTime: string | undefined;
  nowMs: number;
}): boolean {
  const expiryMs = parseDateMs(expirationDateTime);

  if (expiryMs === null) {
    return false;
  }

  const remainingMs = expiryMs - nowMs;

  return remainingMs > 0 && remainingMs <= LEAVING_SOON_WINDOW_MS;
}

/** "Leaving on 16 October at 15:00" when the item expires within 30 days, else undefined. */
export function getLeavingLabel({
  expirationDateTime,
  nowMs,
  timeZone,
}: {
  expirationDateTime: string | undefined;
  nowMs: number;
  timeZone: string | undefined;
}): string | undefined {
  const expiryMs = parseDateMs(expirationDateTime);

  if (expiryMs === null || !isLeavingSoon({ expirationDateTime, nowMs })) {
    return undefined;
  }

  return `Leaving on ${formatDateAtTime({ timeMs: expiryMs, timeZone })}`;
}

const AGE_RATING_LABELS = ["U", "PG", "12", "12A", "15", "18"] as const;

export type AgeRatingLabel = (typeof AGE_RATING_LABELS)[number];

export function normalizeAgeRating(
  label: string | undefined,
): AgeRatingLabel | undefined {
  if (label === undefined) {
    return undefined;
  }

  const normalized = label.trim().toUpperCase();

  return AGE_RATING_LABELS.find((candidate) => candidate === normalized);
}

const AGE_RATING_VALUE_BANDS: { icon: AgeRatingLabel; minValue: number }[] = [
  { icon: "18", minValue: 18 },
  { icon: "15", minValue: 15 },
  { icon: "12", minValue: 12 },
  { icon: "PG", minValue: 8 },
  { icon: "U", minValue: 0 },
];

function ageRatingFromValue(value: number): AgeRatingLabel | undefined {
  return AGE_RATING_VALUE_BANDS.find((band) => value >= band.minValue)?.icon;
}

/** Resolves optional catalogue rating data to a supported badge label. */
export function resolveAgeRating(
  parentalRating: ContentParentalRating | null | undefined,
): AgeRatingLabel | undefined {
  if (parentalRating == null) {
    return undefined;
  }

  const fromLabel = normalizeAgeRating(parentalRating.label);

  if (fromLabel !== undefined) {
    return fromLabel;
  }

  if (parentalRating.value !== undefined) {
    return ageRatingFromValue(parentalRating.value);
  }

  return undefined;
}

/** True when the metadata row has a genre, year, duration or supported rating to show. */
export function hasWatchDetailsMetadata(asset: ContentItem): boolean {
  return (
    getAssetMetadataItems(asset).length > 0 ||
    resolveAgeRating(asset.parentalRating) !== undefined
  );
}

export function getContinueWatching(
  asset: Pick<
    ContentItem,
    | "lastPlayPositionSeconds"
    | "durationSeconds"
    | "contentDurationSeconds"
    | "streamingDurationSeconds"
  >,
): { progress: number; remainingSeconds: number } | undefined {
  const position = asset.lastPlayPositionSeconds;
  const duration = getContentDurationSeconds(asset);

  if (
    position === undefined ||
    position <= 0 ||
    duration === undefined ||
    duration <= 0 ||
    position >= duration
  ) {
    return undefined;
  }

  return {
    progress: position / duration,
    remainingSeconds: duration - position,
  };
}
