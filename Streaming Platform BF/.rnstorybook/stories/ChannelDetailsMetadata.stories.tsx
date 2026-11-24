import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";

import { ChannelDetailsMetadata } from "../../src/features/channel-details/components/channel-details-metadata/channel-details-metadata";

const PROGRAMME = {
  expirationDateTime: "2026-06-10T15:00:00.000Z",
  id: "programme-1",
  parentalRating: { label: "PG" },
  startDateTime: "2026-06-10T14:00:00.000Z",
  title: "The Darjeeling Express",
} as ContentItem;

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue p-4">
    <Story />
  </View>
);

const meta = {
  title: "ChannelDetails/ChannelDetailsMetadata",
  component: ChannelDetailsMetadata,
  decorators: [withDarkBackground],
  parameters: {
    docs: {
      description: {
        component:
          "Displays the programme window using the shared listing-time preference.",
      },
    },
  },
  args: {
    isTablet: false,
    programme: PROGRAMME,
  },
} satisfies Meta<typeof ChannelDetailsMetadata>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const Tablet: Story = {
  args: {
    isTablet: true,
  },
};

export const WithoutAgeRating: Story = {
  args: {
    programme: { ...PROGRAMME, parentalRating: undefined },
  },
};

export const WithoutOnAirWindow: Story = {
  args: {
    programme: {
      ...PROGRAMME,
      expirationDateTime: undefined,
      startDateTime: undefined,
    },
  },
};
