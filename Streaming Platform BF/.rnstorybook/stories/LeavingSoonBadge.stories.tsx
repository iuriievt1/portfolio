import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { LeavingSoonBadge } from "../../src/features/watch-details/components/leaving-soon-badge/leaving-soon-badge";

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue p-4">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/LeavingSoonBadge",
  component: LeavingSoonBadge,
  decorators: [withDarkBackground],
  args: {
    label: "Leaving on 16 October at 15:00",
  },
} satisfies Meta<typeof LeavingSoonBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const Tablet: Story = {
  args: {
    className: "h-[30px] border-[1.25px] px-[10px]",
  },
};
