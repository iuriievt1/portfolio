import type { Channel, ContentItem, ProgrammeGuide } from "@bfbs/common-sdk";
import type { GuideCell, GuideChannel } from "@/features/full-guide/types";
import { toSingleLine } from "@/features/full-guide/utils/guide-cells";
import { sortByChannelNumber } from "@/features/live-channels";
import { parseDateMs } from "@/utils/date-time";
import { pickChannelLogoUrl } from "@/utils/media";
import { getProgrammeEndDateTime } from "@/utils/programme";

function toProgrammeCell(
  channelId: string,
  programme: ContentItem,
): GuideCell | null {
  const startMs = parseDateMs(programme.startDateTime);
  const endMs = parseDateMs(getProgrammeEndDateTime(programme));

  if (startMs === null || endMs === null || endMs <= startMs) {
    return null;
  }

  return {
    endMs,
    id: `${channelId}-${startMs}`,
    programme,
    startMs,
  };
}

function toOrderedCells(channelId: string, programmes: ContentItem[]) {
  return toSingleLine(
    programmes
      .map((programme) => toProgrammeCell(channelId, programme))
      .filter((cell): cell is GuideCell => cell !== null),
  );
}

/** Maps a day of the programme guide onto the channel line-up. */
export function toGuideChannels({
  channels,
  guide,
}: {
  channels: Channel[];
  guide: ProgrammeGuide | undefined;
}): GuideChannel[] {
  const programmesByChannelId = new Map(
    (guide?.channels ?? []).map((guideChannel) => [
      guideChannel.channelId,
      guideChannel.programmes,
    ]),
  );

  return sortByChannelNumber(channels).map((channel) => ({
    cells: toOrderedCells(
      channel.id,
      programmesByChannelId.get(channel.id) ?? [],
    ),
    id: channel.id,
    logoUrl: pickChannelLogoUrl(channel.media),
    name: channel.name,
  }));
}
