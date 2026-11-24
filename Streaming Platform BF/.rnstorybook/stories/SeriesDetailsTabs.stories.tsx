import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { View } from "react-native";
import { fn } from "storybook/test";

import { Text } from "../../src/components";
import { SeriesDetailsTabs } from "../../src/features/watch-details/components/series-details-tabs/series-details-tabs";
import { appQueryClient } from "../../src/infra/query/app-query-client";

// The tabs are the page's list, so they need a screen-high parent.
const withDarkBackground: Decorator = (Story) => (
  <View className="flex-1 bg-dark-slate-blue">
    <Story />
  </View>
);

// The tabs load seasons and episodes through React Query.
const withQueryClient: Decorator = (Story) => (
  <QueryClientProvider client={appQueryClient}>
    <Story />
  </QueryClientProvider>
);

const meta = {
  title: "WatchDetails/SeriesDetailsTabs",
  component: SeriesDetailsTabs,
  decorators: [withDarkBackground, withQueryClient],
  args: {
    header: (
      <Text className="px-4 pt-6 text-[26px] text-white" weight="semibold">
        Series title
      </Text>
    ),
    onScroll: fn(),
    show: { contentType: "show", id: "show-1", title: "Series title" },
    // No show id, so nothing loads.
    showId: undefined,
    tabsGap: 30,
  },
} satisfies Meta<typeof SeriesDetailsTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Phone: Story = {};

export const Tablet: Story = {
  args: {
    isTablet: true,
  },
};
