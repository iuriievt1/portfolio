import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { Button } from "../../src/components";

const meta = {
  title: "Components/Button",
  component: Button,
  args: {
    onPress: fn(),
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Pill: Story = {
  args: {
    children: "On Now",
  },
};

export const Icon: Story = {
  args: {
    variant: "icon",
    className: "h-12 w-12",
    children: <View className="h-5 w-5 rounded-full bg-white" />,
  },
};

export const Action: Story = {
  args: {
    variant: "action",
    icon: <View className="h-5 w-5 rounded-full bg-white" />,
    children: "Restart",
  },
};

export const Link: Story = {
  args: {
    variant: "link",
    children: "← Back",
  },
};
