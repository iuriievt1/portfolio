import { useState } from "react";
import type { GuideChannel } from "@/features/full-guide/types";
import {
  findCellAt,
  findCellById,
  findOpeningCell,
} from "@/features/full-guide/utils/guide-cells";
import { useWatchedChannelId } from "@/features/live-channels";

type GuideSelection = NonNullable<ReturnType<typeof findCellById>>;

function getDefaultSelection(
  channels: GuideChannel[],
  channelId: string | undefined,
  nowMs: number,
): GuideSelection | null {
  const channel =
    channels.find((candidate) => candidate.id === channelId) ?? channels[0];

  if (!channel) {
    return null;
  }

  const cell = findOpeningCell(channel, nowMs);

  return cell ? { cell, channel } : null;
}

/** A pick outlives a refresh: the same card, else whatever now fills its slot. */
function findPickedAgain(
  channels: GuideChannel[],
  picked: GuideSelection,
): GuideSelection {
  return (
    findCellById(channels, picked.cell.id) ??
    findCellAt(channels, picked.channel.id, picked.cell.startMs) ??
    picked
  );
}

/** The guide always has an active programme: the one asked for, or what is on. */
export function useGuideSelection({
  channelId,
  channels,
  nowMs,
}: {
  channelId?: string | undefined;
  channels: GuideChannel[];
  nowMs: number;
}) {
  const [picked, setPicked] = useState<GuideSelection | null>(null);
  const watchedChannelId = useWatchedChannelId();
  const [lastWatchedChannelId, setLastWatchedChannelId] =
    useState(watchedChannelId);

  // The user changed channel in the player: show that channel's live programme.
  if (watchedChannelId !== lastWatchedChannelId) {
    setLastWatchedChannelId(watchedChannelId);
    setPicked(
      getDefaultSelection(channels, watchedChannelId ?? undefined, nowMs),
    );
  }

  const selectCell = (cellId: string) => {
    const found = findCellById(channels, cellId);

    if (found) {
      setPicked(found);
    }
  };

  const selection = picked
    ? findPickedAgain(channels, picked)
    : getDefaultSelection(channels, channelId, nowMs);

  return { selectCell, selection };
}
