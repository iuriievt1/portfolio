import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { View } from "react-native";
import { fn } from "storybook/test";

import { HeroCarousel } from "../../src/features/hero-carousel/components/hero-carousel/hero-carousel";
import { getHeroItems } from "../../src/features/hero-carousel/utils/hero-carousel";
import type { LiveChannel } from "../../src/features/live-channels/types";

const bbcFour = {
  id: "bbc-four",
  media: [
    {
      mimeType: "image/png",
      type: "logo",
      url: "https://placehold.co/120x120/000000/ffffff.png?text=FOUR",
    },
  ],
  name: "BBC Four",
};

const heroItems: ContentItem[] = [
  {
    contentType: "show",
    description:
      "A sheltered girl with telekinetic powers is bullied, leading to a horrific, bloody incident due to her domineering mother's influence.",
    genres: ["Horror Drama"],
    id: "hero-carrie",
    parentalRating: { label: "18" },
    productionYear: 2026,
    title: "Carrie",
  },
  {
    contentType: "vod",
    description: "Animated adventure, featuring the voice of Chris Pratt.",
    genres: ["Comedy", "Family"],
    id: "hero-garfield",
    parentalRating: { label: "U" },
    productionYear: 2024,
    title: "The Garfield Movie",
  },
  // No genres or year, so the metadata row shows the type only.
  {
    contentType: "show",
    description:
      "Contestants from the same area are given a night each to wow the others by hosting a dinner party.",
    id: "hero-come-dine",
    title: "Come Dine with Me",
  },
  // No description, so the phone details area keeps its height anyway.
  {
    contentType: "show",
    genres: ["Reality"],
    id: "hero-traitors",
    title: "The Celebrity Traitors",
  },
].map((item, index) => ({
  ...item,
  channel: bbcFour,
  media: [
    {
      height: 900,
      mimeType: "image/jpeg",
      url: `https://picsum.photos/seed/hero-${index + 1}/1600/900`,
      width: 1600,
    },
  ],
}));

// A GO channel pick: only the channel, no programme.
const bfbsExtraPick: ContentItem = {
  contentType: "channel",
  id: "BFBSTV_EX",
  title: "BFBS Extra",
};

// BFBS Extra with the programme the guide says is on now.
const bfbsExtraNow: LiveChannel = {
  currentProgramme: {
    contentType: "episode",
    description:
      "A documentary crew films the day-to-day lives of office workers at a paper company.",
    durationSeconds: 1800,
    id: "programme-the-office",
    media: [
      {
        height: 900,
        mimeType: "image/jpeg",
        url: "https://picsum.photos/seed/hero-the-office/1600/900",
        width: 1600,
      },
    ],
    parentalRating: { label: "12" },
    startDateTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    title: "The Office",
  },
  id: "BFBSTV_EX",
  media: [
    {
      mimeType: "image/png",
      type: "logo",
      url: "https://placehold.co/120x120/000000/ffffff.png?text=EXTRA",
    },
  ],
  name: "BFBS Extra",
};

// A GO Live Event on BFBS Extra, starting at the given time.
const createLiveEvent = (startOffsetMinutes: number): ContentItem => ({
  channel: {
    id: "BFBSTV_EX",
    media: [
      {
        mimeType: "image/png",
        type: "logo",
        url: "https://placehold.co/120x120/000000/ffffff.png?text=EXTRA",
      },
    ],
    name: "BFBS Extra",
  },
  contentType: "episode",
  description:
    "Sheldon starts high school at nine, while his family adjusts to life with a genius.",
  durationSeconds: 3600,
  id: "event-young-sheldon",
  media: [
    {
      height: 900,
      mimeType: "image/jpeg",
      url: "https://picsum.photos/seed/hero-young-sheldon/1600/900",
      width: 1600,
    },
  ],
  parentalRating: { label: "PG" },
  startDateTime: new Date(
    Date.now() + startOffsetMinutes * 60 * 1000,
  ).toISOString(),
  title: "Young Sheldon",
});

const upcomingEvent = createLiveEvent(90);
const onAirEvent = createLiveEvent(-10);

const createHeroItems = (
  items: ContentItem[],
  liveChannels: Record<string, LiveChannel> = {},
) =>
  getHeroItems({
    items,
    liveChannels,
    nowMs: Date.now(),
    onContentPress: fn(),
    onLivePress: fn(),
  });

const withDarkBackground: Decorator = (Story) => (
  <View className="bg-dark-slate-blue py-4">
    <Story />
  </View>
);

/** Phone or tablet follows the device Storybook runs on. */
const meta = {
  title: "Hero/HeroCarousel",
  component: HeroCarousel,
  decorators: [withDarkBackground],
  args: {
    items: createHeroItems(heroItems),
  },
} satisfies Meta<typeof HeroCarousel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Swipes and loops both ways; dots show on phone. */
export const SeveralItems: Story = {};

/** No swiping and no dots. */
export const OneItem: Story = {
  args: {
    items: createHeroItems(heroItems.slice(0, 1)),
  },
};

/** A channel pick shows what's on now: the LIVE row, the on-air time and the channel logo. */
export const LiveChannelHero: Story = {
  args: {
    items: createHeroItems([bfbsExtraPick, ...heroItems.slice(0, 2)], {
      BFBSTV_EX: bfbsExtraNow,
    }),
  },
};

/** No programme, logo or image: the channel name, LIVE and the placeholder image. */
export const LiveChannelHeroMissingDetails: Story = {
  args: {
    items: createHeroItems([bfbsExtraPick], {
      BFBSTV_EX: { id: "BFBSTV_EX", name: "BFBS Extra" },
    }),
  },
};

/** An upcoming event: when to watch and the rating, and the card can't be tapped. */
export const LiveEventUpcoming: Story = {
  args: {
    items: createHeroItems([upcomingEvent, ...heroItems.slice(0, 2)]),
  },
};

/** The guide has the event on now: the LIVE row, and a tap plays the channel. */
export const LiveEventLive: Story = {
  args: {
    items: createHeroItems([onAirEvent, ...heroItems.slice(0, 2)], {
      [onAirEvent.id]: {
        currentProgramme: onAirEvent,
        id: "BFBSTV_EX",
        name: "BFBS Extra",
      },
    }),
  },
};

/** No image, rating, description or logo: the start time alone, the channel name and the placeholder. */
export const LiveEventMissingDetails: Story = {
  args: {
    items: createHeroItems([
      {
        channel: { id: "BFBSTV_EX", name: "BFBS Extra" },
        contentType: "episode",
        durationSeconds: 3600,
        id: "event-missing-details",
        startDateTime: upcomingEvent.startDateTime ?? "",
        title: "Young Sheldon",
      },
    ]),
  },
};
