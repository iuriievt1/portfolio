import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import type { ChannelRailTile } from "../../src/features/content-rails";
import { TILE_VARIANT } from "../../src/features/content-rails/utils/tile-metrics";
import { ChannelsRail } from "../../src/features/live-channels";

const TILES: ChannelRailTile[] = [
  "BBC One",
  "BBC Two",
  "ITV",
  "Channel 4",
  "Channel 5",
].map((name, index) => ({
  channel: { id: `channel-${index}`, name },
  id: `item-${index}`,
  media: {
    contentFit: "contain" as const,
    url: `https://picsum.photos/seed/${index}/300/300`,
  },
  name,
}));

const meta = {
  title: "LiveChannels/ChannelsRail",
  component: ChannelsRail,
  args: {
    isLoading: false,
    isTablet: false,
    memoryKey: "storybook:channels",
    onTilePress: fn(),
    tiles: TILES,
  },
} satisfies Meta<typeof ChannelsRail>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const LandscapeTiles: Story = {
  args: {
    presentation: { size: "standard", variant: TILE_VARIANT.LANDSCAPE },
  },
};

export const TabletPortrait: Story = {
  args: {
    isTablet: true,
  },
};

export const TabletLandscape: Story = {
  args: {
    isLandscape: true,
    isTablet: true,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    tiles: [],
  },
};
