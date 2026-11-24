/** RN adds 28% above the caps. */
const CAP_LEADING_RATIO = 0.28;

/** Figma gap to RN margin. */
export function capLeading(fontSize: number) {
  return Math.round(fontSize * CAP_LEADING_RATIO);
}
