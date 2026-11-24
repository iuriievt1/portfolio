import type { ContentItem } from "@bfbs/common-sdk";
import type { LiveChannel } from "@/features/live-channels";
import { pickChannelLogoUrl, pickProgrammeImageUrl } from "@/utils/media";
import { getProgrammeEndDateTime } from "@/utils/programme";
import type { MiniGuideChannel, MiniGuideProgramme } from "../types";

function toMiniGuideProgramme(
  programme: ContentItem | undefined,
): MiniGuideProgramme | null {
  if (!programme?.startDateTime) {
    return null;
  }

  return {
    description: programme.description ?? programme.synopsis,
    endsAt: getProgrammeEndDateTime(programme),
    episodeNumber: programme.episodeNumber,
    imageUrl: pickProgrammeImageUrl(programme.media),
    seasonNumber: programme.seasonNumber,
    startsAt: programme.startDateTime,
    title: programme.title,
  };
}

/** Maps a live channel into the Mini Guide view model with preferred logo media. */
export function toMiniGuideChannel(channel: LiveChannel): MiniGuideChannel {
  return {
    id: channel.id,
    logoUrl: pickChannelLogoUrl(channel.media),
    name: channel.name,
    next: toMiniGuideProgramme(channel.nextProgramme),
    now: toMiniGuideProgramme(channel.currentProgramme),
  };
}
