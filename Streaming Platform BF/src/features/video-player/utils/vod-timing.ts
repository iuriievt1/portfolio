import { toProgress } from "@/utils/number";

export function getVodProgress({
  durationSeconds,
  positionSeconds,
}: {
  durationSeconds: number | null;
  positionSeconds: number;
}): number {
  if (durationSeconds === null || durationSeconds <= 0) {
    return 0;
  }

  return toProgress(positionSeconds / durationSeconds);
}

function toWholeSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(Math.floor(value), 0) : 0;
}

export function formatVodTime(totalSeconds: number): string {
  const safeSeconds = toWholeSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  // Under an hour the hour value is dropped rather than shown as "00".
  if (hours === 0) {
    return `${paddedMinutes}:${paddedSeconds}`;
  }

  return `${String(hours).padStart(2, "0")}:${paddedMinutes}:${paddedSeconds}`;
}
