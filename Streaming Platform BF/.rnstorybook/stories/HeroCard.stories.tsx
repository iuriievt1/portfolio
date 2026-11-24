import type { ContentItem } from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { ScrollView } from "react-native";

import { HeroCard } from "../../src/features/hero-carousel/components/hero-card/hero-card";

const carrie: ContentItem = {
  channel: {
    id: "bbc-four",
    media: [
      {
        mimeType: "image/png",
        type: "logo",
        url: "https://placehold.co/120x120/000000/ffffff.png?text=FOUR",
      },
    ],
    name: "BBC Four",
  },
  contentType: "show",
  description:
    "A sheltered girl with telekinetic powers is bullied, leading to a horrific, bloody incident due to her domineering mother's influence.",
  genres: ["Horror Drama"],
  id: "hero-carrie",
  media: [
    {
      height: 900,
      mimeType: "image/jpeg",
      url: "https://picsum.photos/seed/hero-1/1600/900",
      width: 1600,
    },
  ],
  parentalRating: { label: "18" },
  productionYear: 2026,
  title: "Carrie",
};

// GO sends title art as a 9:5 PNG.
const carrieWithTitleArt: ContentItem = {
  ...carrie,
  media: [
    ...(carrie.media ?? []),
    {
      height: 500,
      mimeType: "image/png",
      type: "titleTreatmentNeutral",
      url: "https://placehold.co/900x500/transparent/FFFFFF/png?text=Carrie",
      width: 900,
    },
  ],
};

// Tablet cards are wider than a phone, so they scroll sideways.
const withDarkBackground: Decorator = (Story) => (
  <ScrollView
    className="bg-dark-slate-blue"
    contentContainerClassName="p-4"
    horizontal
  >
    <Story />
  </ScrollView>
);

/** Each layout at its Figma width, on any device. */
const meta = {
  title: "Hero/HeroCard",
  component: HeroCard,
  decorators: [withDarkBackground],
  args: {
    formFactor: "phone",
    item: carrie,
    width: 343,
  },
} satisfies Meta<typeof HeroCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Title and logo on the artwork; metadata and description below. */
export const Phone: Story = {};

/** Everything on the artwork. */
export const TabletPortrait: Story = {
  args: {
    formFactor: "tabletPortrait",
    width: 741,
  },
};

export const TabletLandscape: Story = {
  args: {
    formFactor: "tabletLandscape",
    width: 960,
  },
};

/** Title art in place of the title text. */
export const PhoneWithTitleArt: Story = {
  args: {
    item: carrieWithTitleArt,
  },
};

export const TabletPortraitWithTitleArt: Story = {
  args: {
    formFactor: "tabletPortrait",
    item: carrieWithTitleArt,
    width: 741,
  },
};

export const TabletLandscapeWithTitleArt: Story = {
  args: {
    formFactor: "tabletLandscape",
    item: carrieWithTitleArt,
    width: 960,
  },
};
