import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { SeasonSelector } from "../../src/features/watch-details/components/season-selector/season-selector";

const SEASON_ONE: ContentItem = {
  id: "season-1",
  seasonNumber: "1",
  title: "Season one",
};

const SEASONS: ContentItem[] = [
  SEASON_ONE,
  { id: "season-2", seasonNumber: "2", title: "Season two" },
  { id: "season-3", seasonNumber: "3", title: "Season three" },
];

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue px-4 py-6">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/SeasonSelector",
  component: SeasonSelector,
  decorators: [withDarkBackground],
  args: {
    onSelect: fn(),
    seasons: SEASONS,
    selectedSeason: SEASON_ONE,
  },
} satisfies Meta<typeof SeasonSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};
