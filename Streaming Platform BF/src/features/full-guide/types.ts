import type { ContentItem } from "@bfbs/common-sdk";

export type GuideDay = {
  endMs: number;
  key: string;
  startMs: number;
};

export type GuideCell = {
  endMs: number;
  id: string;
  programme: ContentItem;
  startMs: number;
};

export type GuideChannel = {
  cells: GuideCell[];
  id: string;
  logoUrl: string | undefined;
  name: string;
};
