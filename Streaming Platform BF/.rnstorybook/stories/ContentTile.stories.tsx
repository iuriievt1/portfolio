import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import {
  ContentTile,
  TILE_VARIANT,
} from "../../src/features/content-rails";
import type { RailTile } from "../../src/features/content-rails";

const vodTile: RailTile = {
  contentType: "vod",
  id: "frasier",
  media: [
    {
      mimeType: "image/jpeg",
      type: "poster",
      url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800",
    },
  ],
  title: "Frasier",
};

const liveTile: RailTile = {
  channelName: "BFBS Edge",
  contentType: "live",
  id: "bfbs-edge",
  media: [
    {
      mimeType: "image/jpeg",
      type: "poster",
      url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800",
    },
  ],
  progressEndMs: Date.now() + 30 * 60 * 1000,
  progressStartMs: Date.now() - 15 * 60 * 1000,
  timeLabel: "12:30 - 13:15",
  title: "Forces News",
};

const genreTile: RailTile = {
  categoryId: "films",
  contentType: "category",
  id: "films",
  media: vodTile.media,
  title: "Films",
};

const meta = {
  title: "ContentRails/ContentTile",
  component: ContentTile,
  args: {
    onPress: fn(),
    size: "standard",
    tile: vodTile,
    width: 168,
  },
} satisfies Meta<typeof ContentTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StandardVod: Story = {};

export const WithProgress: Story = {
  args: { progress: 0.4 },
};

export const WithoutImage: Story = {
  args: {
    tile: { ...vodTile, media: [] },
  },
};

export const UnavailableImage: Story = {
  args: {
    tile: {
      ...vodTile,
      id: "unavailable-image",
      media: [
        {
          mimeType: "image/jpeg",
          type: "poster",
          url: "invalid://artwork",
        },
      ],
    },
  },
};

export const LargeVod: Story = {
  args: {
    size: "large",
    tile: { ...vodTile, id: "long-patrol", title: "The Long Patrol" },
    width: 255,
  },
};

export const Short: Story = {
  args: {
    tile: {
      ...vodTile,
      channelMedia: [
        {
          mimeType: "image/png",
          type: "logo",
          url: "https://placehold.co/180x80/074f71/ffffff.png?text=BFBS",
        },
      ],
      channelName: "BFBS Forces Sport",
      durationSeconds: 32,
      id: "short",
      title: "British Army rescue teams put to the test",
    },
    variant: TILE_VARIANT.VERTICAL,
  },
};

export const SquareVod: Story = {
  args: {
    tile: { ...vodTile, id: "square-fragile", title: "Fragile" },
    variant: TILE_VARIANT.SQUARE_CARD,
  },
};

export const Genre: Story = {
  args: {
    tile: genreTile,
    variant: TILE_VARIANT.SQUARE_CARD,
  },
};

export const LandscapeCategoryNavigation: Story = {
  args: {
    tile: { ...genreTile, id: "bbc-one-shop", title: "BBC One" },
  },
};

export const StandardLive: Story = {
  args: {
    size: "standard",
    tile: liveTile,
  },
};

export const LargeLive: Story = {
  args: {
    size: "large",
    tile: liveTile,
    width: 255,
  },
};
