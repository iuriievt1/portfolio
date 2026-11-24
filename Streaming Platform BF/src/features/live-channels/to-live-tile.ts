import type { RailTile } from "@/features/content-rails/types";
import { getDeviceTimeZone, parseDateMs } from "@/utils/date-time";
import {
  formatProgrammeOnAirWindow,
  getProgrammeEndDateTime,
} from "@/utils/programme";
import type { LiveChannel } from "./types";

// Maps a live channel to a rail tile labelled with its on-air window.
export function toLiveTile(
  channel: LiveChannel,
  timeZone = getDeviceTimeZone(),
): RailTile {
  const programme = channel.currentProgramme;
  const timeLabel = programme
    ? formatProgrammeOnAirWindow(programme, timeZone)
    : undefined;
  const progressStartMs = programme
    ? parseDateMs(programme.startDateTime)
    : null;
  const progressEndMs = programme
    ? parseDateMs(getProgrammeEndDateTime(programme))
    : null;

  return {
    ...(channel.media ? { channelMedia: channel.media } : {}),
    channelName: channel.name,
    contentType: "live",
    id: channel.id,
    ...(programme?.media ? { media: programme.media } : {}),
    ...(progressEndMs === null ? {} : { progressEndMs }),
    ...(progressStartMs === null ? {} : { progressStartMs }),
    ...(timeLabel ? { timeLabel } : {}),
    title: programme?.title ?? channel.name,
  };
}
