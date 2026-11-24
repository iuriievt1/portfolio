import type { GuideChannel } from "@/features/full-guide/types";
import { toSingleLine } from "@/features/full-guide/utils/guide-cells";

/** One row spans the week, so the loaded days join into a single line. */
export function mergeGuideChannels(
  channelsByDay: Record<string, GuideChannel[]>,
): GuideChannel[] {
  const merged = new Map<string, GuideChannel>();

  for (const channels of Object.values(channelsByDay)) {
    for (const channel of channels) {
      const existing = merged.get(channel.id);

      if (existing) {
        existing.cells.push(...channel.cells);
      } else {
        merged.set(channel.id, { ...channel, cells: [...channel.cells] });
      }
    }
  }

  return [...merged.values()].map((channel) => ({
    ...channel,
    cells: toSingleLine(channel.cells),
  }));
}
