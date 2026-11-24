import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { SearchResultsGrid } from "../../src/features/search";

const CURRENT_VOD: ContentItem[] = [
  {
    contentType: "show",
    id: "forces-news",
    media: [
      {
        type: "poster",
        url: "https://picsum.photos/seed/forces-news/640/360",
      },
    ],
    title: "Forces News",
  },
  {
    contentType: "standalone",
    id: "military-history",
    media: [
      {
        type: "poster",
        url: "https://picsum.photos/seed/military-history/640/360",
      },
    ],
    title: "Military History",
  },
];

const MIXED_RESULTS: ContentItem[] = [
  ...CURRENT_VOD,
  {
    contentType: "channel",
    id: "bfbs-live",
    title: "BFBS Live",
  },
  {
    channelId: "bfbs-live",
    contentType: "linearStandalone",
    id: "live-event",
    media: [
      {
        type: "poster",
        url: "https://picsum.photos/seed/live-event/640/360",
      },
    ],
    title: "Live from Catterick",
  },
  {
    availableSinceDateTime: "2099-01-01T12:00:00.000Z",
    contentType: "standalone",
    id: "future-documentary",
    title: "Coming Soon",
  },
];

const withScreen: Decorator = (Story) => (
  <View className="h-[760px] bg-dark-slate-blue pt-4">
    <Story />
  </View>
);

const meta = {
  title: "Search/SearchResultsGrid",
  component: SearchResultsGrid,
  decorators: [withScreen],
  args: {
    channels: [],
    error: null,
    isLoading: false,
    items: CURRENT_VOD,
    nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
    onResultPress: fn(),
    onRetry: fn(),
    submittedQuery: "mil",
  },
} satisfies Meta<typeof SearchResultsGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const MixedContent: Story = {
  args: {
    items: MIXED_RESULTS,
  },
};

export const MissingMetadata: Story = {
  args: {
    items: [
      {
        contentType: "standalone",
        id: "missing-artwork",
        title: "Content without artwork",
      },
    ],
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const Failed: Story = {
  args: {
    error: new Error("Search is unavailable"),
    items: [],
  },
};
