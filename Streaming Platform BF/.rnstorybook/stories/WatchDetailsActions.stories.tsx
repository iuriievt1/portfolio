import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { WatchDetailsActions } from "../../src/features/watch-details/components/watch-details-actions/watch-details-actions";

const withDarkBackground: Decorator = (Story) => (
  <View className="w-[360px] bg-dark-slate-blue p-4">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/WatchDetailsActions",
  component: WatchDetailsActions,
  decorators: [withDarkBackground],
  args: {
    onSecondary: fn(),
    onWatch: fn(),
  },
} satisfies Meta<typeof WatchDetailsActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Watch: Story = {};

export const Resume: Story = {
  args: {
    watchLabel: "Resume",
  },
};

export const SeriesWatch: Story = {
  args: {
    watchLabel: "Watch S1 E1",
  },
};

export const SeriesResume: Story = {
  args: {
    watchLabel: "Resume S9 E4",
  },
};

export const SeriesEpisodeOnly: Story = {
  args: {
    watchLabel: "Watch E1",
  },
};

export const LiveChannelPhone: Story = {
  args: {
    secondaryIcon: null,
    secondaryLabel: "TV Guide",
    watchLabel: "Watch Live",
  },
};

export const LiveChannelTablet: Story = {
  args: {
    buttonWidth: 174,
    direction: "row",
    secondaryIcon: null,
    secondaryLabel: "TV Guide",
    textSizeClassName: "text-[16px]",
    watchLabel: "Watch Live",
  },
};
