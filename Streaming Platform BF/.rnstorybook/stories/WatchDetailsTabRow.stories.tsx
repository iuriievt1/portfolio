import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { WatchDetailsTabRow } from "../../src/features/watch-details/components/watch-details-tabs/watch-details-tab-row";
import { getWatchDetailsTabs } from "../../src/features/watch-details/components/watch-details-tabs/watch-details-tabs";

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue px-4 py-6">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/WatchDetailsTabRow",
  component: WatchDetailsTabRow,
  decorators: [withDarkBackground],
  args: {
    onSelect: fn(),
    selectedTab: "related",
    tabs: getWatchDetailsTabs(true, true),
  },
} satisfies Meta<typeof WatchDetailsTabRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const Tablet: Story = {
  args: {
    isTablet: true,
  },
};
