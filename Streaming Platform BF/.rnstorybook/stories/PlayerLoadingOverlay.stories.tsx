import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { PlayerLoadingOverlay } from "../../src/features/video-player/components/player-loading-overlay";

const meta = {
  title: "Player/PlayerLoadingOverlay",
  component: PlayerLoadingOverlay,
  args: {
    delayMs: 0,
  },
  decorators: [
    (Story) => (
      <View className="flex-1 bg-dark-slate-blue">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof PlayerLoadingOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Immediate: Story = {};

export const Delayed: Story = {
  args: {
    delayMs: 3000,
  },
};
