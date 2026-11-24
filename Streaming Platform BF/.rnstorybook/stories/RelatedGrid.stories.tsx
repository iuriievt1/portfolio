import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { RelatedGrid } from "../../src/features/watch-details/components/related-pane/related-grid";
import {
  RELATED_COLUMNS,
  RELATED_TILE_GAP,
} from "../../src/features/watch-details/components/watch-details-tablet/tablet-metrics";

const ITEMS = Array.from({ length: 6 }, (_, index) => ({
  contentType: "standalone",
  id: `related-${index}`,
  media: [
    {
      type: "image",
      url: `https://picsum.photos/seed/related-${index}/336/189`,
    },
  ],
  title: `Related title ${index + 1}`,
})) as ContentItem[];

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue px-4 py-6">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/RelatedGrid",
  component: RelatedGrid,
  decorators: [withDarkBackground],
  args: {
    className: "flex-row flex-wrap gap-y-6",
    columnGap: 8,
    columns: 2,
    isError: false,
    isLoading: false,
    items: ITEMS,
    onSelect: fn(),
  },
} satisfies Meta<typeof RelatedGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    items: [],
  },
};

export const Failed: Story = {
  args: {
    isError: true,
    items: [],
  },
};

// The 4-column grid the movie and series pages use on tablet.
export const Tablet: Story = {
  args: {
    columnGap: RELATED_TILE_GAP,
    columns: RELATED_COLUMNS,
  },
};
