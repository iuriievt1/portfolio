import type { Channel, ContentItem } from "@bfbs/common-sdk";

export type LiveChannel = Channel & {
  currentProgramme?: ContentItem;
  nextProgramme?: ContentItem;
};
