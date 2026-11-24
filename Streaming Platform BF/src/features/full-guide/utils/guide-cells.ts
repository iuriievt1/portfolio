import type {
  GuideCell,
  GuideChannel,
  GuideDay,
} from "@/features/full-guide/types";
import {
  MISSING_PROGRAMME_LABEL,
  MISSING_PROGRAMME_SYNOPSIS,
} from "@/utils/programme";

type TimeSpan = Pick<GuideDay, "endMs" | "startMs">;

/** Whether a span of time covers a moment. */
export function covers({ endMs, startMs }: TimeSpan, timeMs: number) {
  return timeMs >= startMs && timeMs < endMs;
}

/** Whether a cell is the one on air. */
export function isCellLive(cell: GuideCell, nowMs: number) {
  return covers(cell, nowMs);
}

/** Puts spans in order of their start. */
export function byStartMs(first: TimeSpan, second: TimeSpan) {
  return first.startMs - second.startMs;
}

/** The first cell a viewer can act on: what is on air, else the earliest. */
export function findOpeningCell(channel: GuideChannel, nowMs: number) {
  return (
    channel.cells.find((cell) => isCellLive(cell, nowMs)) ?? channel.cells[0]
  );
}

/** The cell with an id, together with the channel it plays on. */
export function findCellById(channels: GuideChannel[], cellId: string) {
  for (const channel of channels) {
    const cell = channel.cells.find((candidate) => candidate.id === cellId);

    if (cell) {
      return { cell, channel };
    }
  }

  return null;
}

/** The cell on a channel that covers a moment, with the channel it plays on. */
export function findCellAt(
  channels: GuideChannel[],
  channelId: string,
  timeMs: number,
) {
  const channel = channels.find((candidate) => candidate.id === channelId);
  const cell = channel?.cells.find((candidate) => covers(candidate, timeMs));

  return channel && cell ? { cell, channel } : null;
}

/** Orders and trims cells so none starts before the one before it ends. */
export function toSingleLine(cells: GuideCell[]): GuideCell[] {
  const ordered: GuideCell[] = [];
  let cursorMs = Number.NEGATIVE_INFINITY;

  for (const cell of [...cells].sort(byStartMs)) {
    const startMs = Math.max(cell.startMs, cursorMs);

    if (cell.endMs <= startMs) {
      continue;
    }

    ordered.push({ ...cell, startMs });
    cursorMs = cell.endMs;
  }

  return ordered;
}

function toGapCell({
  channelId,
  endMs,
  startMs,
}: {
  channelId: string;
  endMs: number;
  startMs: number;
}): GuideCell {
  const id = `${channelId}-gap-${startMs}`;

  return {
    endMs,
    id,
    programme: {
      expirationDateTime: new Date(endMs).toISOString(),
      id,
      startDateTime: new Date(startMs).toISOString(),
      synopsis: MISSING_PROGRAMME_SYNOPSIS,
      title: MISSING_PROGRAMME_LABEL,
    },
    startMs,
  };
}

function toLoadedSpans(days: GuideDay[]) {
  const spans: TimeSpan[] = [];

  for (const day of [...days].sort(byStartMs)) {
    const last = spans.at(-1);

    if (last && day.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, day.endMs);
      continue;
    }

    spans.push({ endMs: day.endMs, startMs: day.startMs });
  }

  return spans;
}

function fillCells(channelId: string, cells: GuideCell[], days: GuideDay[]) {
  const ordered = [...cells].sort(byStartMs);
  const filled = [...cells];

  for (const span of toLoadedSpans(days)) {
    let cursorMs = span.startMs;

    for (const cell of ordered) {
      if (cell.endMs <= span.startMs || cell.startMs >= span.endMs) {
        continue;
      }

      if (cell.startMs > cursorMs) {
        filled.push(
          toGapCell({ channelId, endMs: cell.startMs, startMs: cursorMs }),
        );
      }

      cursorMs = Math.max(cursorMs, cell.endMs);
    }

    if (cursorMs < span.endMs) {
      filled.push(
        toGapCell({ channelId, endMs: span.endMs, startMs: cursorMs }),
      );
    }
  }

  return filled.sort(byStartMs);
}

/** Fills every hole the loaded days leave in a row with a card saying so. */
export function fillGuideGaps(
  channels: GuideChannel[],
  loadedDays: GuideDay[],
): GuideChannel[] {
  return channels.map((channel) => ({
    ...channel,
    cells: fillCells(channel.id, channel.cells, loadedDays),
  }));
}
