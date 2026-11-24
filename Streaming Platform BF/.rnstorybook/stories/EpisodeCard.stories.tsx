import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { EpisodeCard } from "../../src/features/watch-details/components/episode-card/episode-card";

const EPISODE: ContentItem = {
  contentType: "episode",
  durationSeconds: 1800,
  episodeNumber: "1",
  episodeTitle: "Pilot",
  id: "episode-1",
  media: [
    {
      mimeType: "image/jpeg",
      type: "image",
      url: "https://picsum.photos/seed/episode-1/336/189",
    },
  ],
  synopsis: "A film crew arrives to spend a week at the branch office.",
  title: "Series title",
};

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue px-4 py-6">
    <Story />
  </View>
);

const meta = {
  title: "WatchDetails/EpisodeCard",
  component: EpisodeCard,
  decorators: [withDarkBackground],
  args: {
    episode: EPISODE,
    onPress: fn(),
  },
} satisfies Meta<typeof EpisodeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unwatched: Story = {};

export const PartWatched: Story = {
  args: {
    episode: { ...EPISODE, lastPlayPositionSeconds: 900 },
  },
};
