import {
  ContentCategoryTemplate,
  type ContentItem,
  type ContentRail as RailPlacement,
} from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { ContentRail } from "../../src/features/content-rails";

const genreItems: ContentItem[] = [
  ["films", "Films"],
  ["shows", "Shows"],
  ["kids", "Kids"],
  ["documentaries", "Documentaries"],
  ["comedy", "Comedy"],
].map(([id, title]) => ({
  categoryId: id,
  contentType: "category",
  id,
  // Films has no artwork, so it shows the shared programme fallback.
  ...(id === "films"
    ? {}
    : {
        media: [
          {
            height: 600,
            mimeType: "image/jpeg",
            url: `https://picsum.photos/seed/genre-${id}/600/600`,
            width: 600,
          },
        ],
      }),
  title,
}));

const genreRail: RailPlacement = {
  category: { id: "genre-rail", name: "Sport", type: "swimlane" },
  items: genreItems,
  metadata: { count: genreItems.length, total: genreItems.length },
  template: ContentCategoryTemplate.SQUARE_LARGE,
};

const vodRail: RailPlacement = {
  category: { id: "vod-manual", name: "Box Sets", type: "swimlane" },
  items: ["The Long Patrol", "Frontline", "Service Stories", "Homecoming"].map(
    (title, index) => ({
      contentType: "standalone",
      id: `tile-${index + 1}`,
      media: [
        {
          height: 900,
          mimeType: "image/jpeg",
          url: `https://picsum.photos/seed/vod-${index + 1}/1600/900`,
          width: 1600,
        },
      ],
      title,
    }),
  ),
  template: ContentCategoryTemplate.SIXTEEN_BY_NINE_LARGE,
};

const bfbsExtra = {
  id: "bfbs-extra",
  media: [
    {
      mimeType: "image/png",
      url: "https://picsum.photos/seed/bfbs-extra-logo/90/40",
    },
  ],
  name: "BFBS Extra",
};

// 12 items, so the rail shows the cut at 10.
const top10Items: ContentItem[] = [
  "Venom",
  "Interstellar",
  "Military Wives",
  "Tinker Tailor Soldier Spy",
  "Reservoir Dogs",
  "The Long Patrol",
  "Frontline",
  "Service Stories",
  "Homecoming",
  "Ice Age",
  "Scrubs",
  "The Office",
].map((title, index) => ({
  // Item 2 has no channel logo.
  ...(index === 1 ? {} : { channel: bfbsExtra }),
  contentType: "standalone",
  id: `top-10-${index + 1}`,
  // Item 3 has no artwork, so it shows the fallback.
  ...(index === 2
    ? {}
    : {
        media: [
          {
            height: 900,
            mimeType: "image/jpeg",
            url: `https://picsum.photos/seed/top-10-${index + 1}/1600/900`,
            width: 1600,
          },
        ],
      }),
  title,
}));

// No maximum from GO: the app still stops at 10.
const top10Rail: RailPlacement = {
  category: { id: "bfbs_top_10", name: "BFBS Top 10", type: "swimlane" },
  items: top10Items,
  metadata: { count: top10Items.length, total: top10Items.length },
  template: ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL,
};

const continueWatchingItems: ContentItem[] = [
  { percent: 20, title: "I Swear" },
  { percent: 55, title: "Forensics: The real CSI" },
  { percent: 80, title: "Call the Midwife" },
  { percent: 35, title: "Derry Girls" },
].map(({ percent, title }, index) => ({
  contentType: "standalone",
  durationSeconds: 100,
  id: `cw-${index + 1}`,
  lastPlayPositionSeconds: percent,
  // Derry Girls has no image, so it shows the fallback artwork.
  ...(title === "Derry Girls"
    ? {}
    : {
        media: [
          {
            height: 900,
            mimeType: "image/jpeg",
            url: `https://picsum.photos/seed/cw-${index + 1}/1600/900`,
            width: 1600,
          },
        ],
      }),
  title,
}));

/** GO's Continue Watching rail: progress on every tile, never View All. */
const continueWatchingRail: RailPlacement = {
  category: { id: "Continue", name: "Continue Watching", type: "content_full" },
  items: continueWatchingItems,
  metadata: { count: continueWatchingItems.length, total: 40 },
  template: ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD,
};

const shortsRail: RailPlacement = {
  category: { id: "shorts", name: "Shorts", type: "swimlane" },
  items: vodRail.items?.map((item, index) => ({
    ...item,
    channel: {
      id: "bfbs-forces-sport",
      media: [
        {
          mimeType: "image/png",
          type: "logo",
          url: "https://placehold.co/180x80/074f71/ffffff.png?text=BFBS",
        },
      ],
      name: "BFBS Forces Sport",
    },
    durationSeconds: 32 + index * 7,
    id: `short-${index + 1}`,
    media: [
      {
        height: 1600,
        mimeType: "image/jpeg",
        url: `https://picsum.photos/seed/short-${index + 1}/900/1600`,
        width: 900,
      },
    ],
  })),
  template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

queryClient.setQueryData(["railItems", genreRail.category.id], {
  pageParams: [0],
  pages: [
    {
      categoryId: genreRail.category.id,
      items: genreItems,
      metadata: genreRail.metadata,
    },
  ],
});

const meta = {
  title: "ContentRails/ContentRail",
  component: ContentRail,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    isTablet: false,
    onTilePress: fn(),
    rail: vodRail,
  },
} satisfies Meta<typeof ContentRail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LargeVodRail: Story = {};

export const Top10Rail: Story = {
  args: { rail: top10Rail },
};

export const ShortsRail: Story = {
  args: { rail: shortsRail },
};

export const GenrePhone: Story = {
  args: { rail: genreRail },
};

export const GenreTabletPortrait: Story = {
  args: { isTablet: true, rail: genreRail },
};

export const GenreTabletLandscape: Story = {
  args: { isLandscape: true, isTablet: true, rail: genreRail },
};

export const ContinueWatchingPhone: Story = {
  args: { rail: continueWatchingRail },
};

export const ContinueWatchingTabletPortrait: Story = {
  args: { isTablet: true, rail: continueWatchingRail },
};

export const ContinueWatchingTabletLandscape: Story = {
  args: { isLandscape: true, isTablet: true, rail: continueWatchingRail },
};
