/** Keeps a value inside the closed range between two bounds. */
export function clamp({
  max,
  min,
  value,
}: {
  max: number;
  min: number;
  value: number;
}) {
  return Math.min(Math.max(value, min), max);
}

/** Keeps a progress value inside the 0-1 range. */
export function toProgress(value: number) {
  return clamp({ max: 1, min: 0, value });
}
