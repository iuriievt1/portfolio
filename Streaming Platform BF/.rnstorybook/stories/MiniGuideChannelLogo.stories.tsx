import type { Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { MiniGuideChannelLogo } from "../../src/features/mini-guide/components/mini-guide-channel-logo/mini-guide-channel-logo";

const DEMO_LOGO_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 90 60'%3E%3Crect width='90' height='60' rx='12' fill='%23F6C83E'/%3E%3Ctext x='45' y='37' text-anchor='middle' font-size='22' font-family='Arial' fill='%230B1220'%3EBFBS%3C/text%3E%3C/svg%3E";

type StoryArgs = {
  name: string;
  showLogo: boolean;
  variant: "mobile" | "tablet-portrait" | "tablet-landscape";
};

const meta = {
  title: "MiniGuide/ChannelLogo",
  args: {
    name: "BFBS TV",
    showLogo: true,
    variant: "mobile",
  },
  argTypes: {
    showLogo: {
      control: "boolean",
    },
    variant: {
      control: "radio",
      options: ["mobile", "tablet-portrait", "tablet-landscape"],
    },
  },
  render: ({ name, showLogo, variant }) => (
    <View className="h-24 w-28 bg-medium-slate-blue/70 p-4">
      <MiniGuideChannelLogo
        logoUrl={showLogo ? DEMO_LOGO_DATA_URI : undefined}
        name={name}
        variant={variant}
      />
    </View>
  ),
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FallbackText: Story = {
  args: {
    showLogo: false,
  },
};
