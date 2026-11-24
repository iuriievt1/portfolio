import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { EpisodesFooter } from "../../src/features/watch-details/components/episodes-footer/episodes-footer";

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue px-4 py-6">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/EpisodesFooter",
  component: EpisodesFooter,
  decorators: [withDarkBackground],
  args: {
    hasError: false,
    isLoading: false,
    isTablet: false,
    onRetry: fn(),
  },
} satisfies Meta<typeof EpisodesFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Failed: Story = {
  args: {
    hasError: true,
  },
};
