import {
  ContentCategoryTemplate,
  type ContentRail,
  type MediaImage,
} from "@bfbs/common-sdk";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { ScrollView } from "react-native";

import { PromoBanner } from "../../src/features/promo-banner/components/promo-banner/promo-banner";

const createImage = (
  width: number,
  height: number,
  label: string,
): MediaImage => ({
  height,
  mimeType: "image/png",
  type: "regular",
  url: `https://placehold.co/${width}x${height}/04283A/FFFFFF.png?text=${encodeURIComponent(label)}`,
  width,
});

// GO sends a banner as a placeholder category, with every platform's art as "regular" images.
const createPromoRail = (name: string, media: MediaImage[]): ContentRail => ({
  category: {
    destination: { type: "external", url: "https://www.bfbs.com/" },
    id: name,
    media,
    name,
    type: "placeholder",
  },
  template: ContentCategoryTemplate.HERO,
});

const withDarkBackground: Decorator = (Story) => (
  <ScrollView className="bg-dark-slate-blue" contentContainerClassName="py-4">
    <Story />
  </ScrollView>
);

/** Shown at this device's size: phone picks the tallest image, tablet the widest that fits. */
const meta = {
  title: "Promo/PromoBanner",
  component: PromoBanner,
  decorators: [withDarkBackground],
  args: {
    rail: createPromoRail("Large promo", [
      createImage(343, 528, "Large phone 343 x 528"),
      createImage(739, 306, "Large tablet 739 x 306"),
    ]),
  },
} satisfies Meta<typeof PromoBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Tall on phone, wide on tablet. */
export const Large: Story = {};

/** Thin on every device. The CTV art is never picked. */
export const Small: Story = {
  args: {
    rail: createPromoRail("Small promo", [
      createImage(1690, 325, "Small CTV 1690 x 325"),
      createImage(343, 150, "Small phone 343 x 150"),
      createImage(740, 152, "Small tablet 740 x 152"),
    ]),
  },
};

/** The image fails to load, so the banner is hidden and leaves no gap. */
export const Unavailable: Story = {
  args: {
    rail: createPromoRail("Unavailable promo", [
      {
        height: 150,
        mimeType: "image/png",
        type: "regular",
        url: "https://images.invalid/promo.png",
        width: 343,
      },
    ]),
  },
};
