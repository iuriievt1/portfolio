import type { ContentCategory, MediaImage } from "@bfbs/common-sdk";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { PromoBanner } from "@/features/promo-banner/components/promo-banner/promo-banner";
import { createCategory, createRail } from "../../__fixtures__/content";

const mockOpenExternalUrl = jest.fn();
let mockLayout = { isTablet: false, width: 375 };

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => mockLayout,
}));

jest.mock("@/utils/external-url", () => ({
  openExternalUrl: (options: unknown) => mockOpenExternalUrl(options),
}));

// GO puts every platform's art on one banner, as it does for Promo 1.
const CTV_SMALL: MediaImage = {
  height: 325,
  mimeType: "image/png",
  type: "regular",
  url: "https://images.test/Size=Small Promotional Banner.png",
  width: 1690,
};
const PHONE_SMALL: MediaImage = {
  height: 150,
  mimeType: "image/png",
  type: "regular",
  url: "https://images.test/Platform=Mobile, Size=Landscape.png",
  width: 343,
};
const TABLET_SMALL: MediaImage = {
  height: 152,
  mimeType: "image/png",
  type: "regular",
  url: "https://images.test/Platform=Tablet [Portrait], Size=Standard.png",
  width: 740,
};
// Promo 2 only has the tablet art.
const TABLET_LARGE: MediaImage = {
  height: 306,
  mimeType: "image/png",
  type: "regular",
  url: "https://images.test/Platform=Tablet [Portrait], Size=Large.png",
  width: 739,
};
// The tall phone art the design asks for, at 1× and 2×.
const PHONE_LARGE: MediaImage = {
  height: 528,
  mimeType: "image/png",
  type: "regular",
  url: "https://images.test/Platform=Mobile, Size=Portrait.png",
  width: 343,
};
const PHONE_LARGE_2X: MediaImage = {
  ...PHONE_LARGE,
  height: 1056,
  url: "https://images.test/Platform=Mobile, Size=Portrait@2x.png",
  width: 686,
};

const VENOM_ID =
  "f36ac790-8a32-50aa-b543-02d4c5da0bb4~GO_GO1200009902500000~vod";

const createPromoRail = (category: Partial<ContentCategory> = {}) =>
  createRail({
    category: createCategory({
      id: "promo-1",
      media: [CTV_SMALL, PHONE_SMALL, TABLET_SMALL],
      name: "Promo Banner Test 1",
      type: "placeholder",
      ...category,
    }),
  });

const getImage = () => screen.getByTestId("promo-banner-image");
const getImageStyle = () => StyleSheet.flatten(getImage().props.style);

describe("PromoBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLayout = { isTablet: false, width: 375 };
  });

  test.each([
    ["phone", { isTablet: false, width: 375 }, PHONE_SMALL, 343],
    ["wider phone", { isTablet: false, width: 411 }, PHONE_SMALL, 379],
    ["tablet portrait", { isTablet: true, width: 820 }, TABLET_SMALL, 740],
    ["tablet landscape", { isTablet: true, width: 1180 }, TABLET_SMALL, 1100],
  ])("shows the %s art at the page width, in its own shape", (_, layout, image, width) => {
    mockLayout = layout;

    render(<PromoBanner rail={createPromoRail()} />);

    expect(JSON.stringify(getImage().props.source)).toContain(
      image.url.replace(/[ [\]]/g, encodeURIComponent),
    );
    expect(getImageStyle()).toMatchObject({
      aspectRatio: (image.width ?? 0) / (image.height ?? 1),
      width,
    });
  });

  test.each([
    ["phone", { isTablet: false, width: 375 }, 343],
    ["tablet portrait", { isTablet: true, width: 820 }, 740],
    ["tablet landscape", { isTablet: true, width: 1180 }, 1100],
  ])("shows a Large banner's only image on a %s", (_, layout, width) => {
    mockLayout = layout;

    render(<PromoBanner rail={createPromoRail({ media: [TABLET_LARGE] })} />);

    expect(getImageStyle()).toMatchObject({ aspectRatio: 739 / 306, width });
  });

  test("picks the largest copy of the tallest image on a phone", () => {
    render(
      <PromoBanner
        rail={createPromoRail({
          media: [TABLET_LARGE, PHONE_LARGE, PHONE_LARGE_2X],
        })}
      />,
    );

    expect(JSON.stringify(getImage().props.source)).toContain(
      "Size=Portrait@2x.png",
    );
    expect(getImageStyle()).toMatchObject({
      aspectRatio: 343 / 528,
      width: 343,
    });
  });

  test("keeps the tablet art on a tablet when a tall phone image is sent", () => {
    mockLayout = { isTablet: true, width: 820 };

    render(
      <PromoBanner
        rail={createPromoRail({
          media: [TABLET_LARGE, PHONE_LARGE, PHONE_LARGE_2X],
        })}
      />,
    );

    expect(getImageStyle()).toMatchObject({
      aspectRatio: 739 / 306,
      width: 740,
    });
  });

  test("opens a web destination outside the app", () => {
    render(
      <PromoBanner
        rail={createPromoRail({
          destination: { type: "external", url: "https://www.bfbs.com/" },
        })}
      />,
    );

    const bannerLink = screen.getByRole("link", {
      name: "Promo Banner Test 1",
    });
    expect(bannerLink.props.accessibilityHint).toBe(
      "Opens the link in your browser",
    );
    fireEvent.press(bannerLink);

    expect(mockOpenExternalUrl).toHaveBeenCalledWith({
      tags: { area: "promo_banner", operation: "open_link" },
      url: "https://www.bfbs.com/",
    });
  });

  test("opens an in-app title through the page's content rules", () => {
    const onContentPress = jest.fn();
    const rail = createPromoRail({
      destination: { assetId: VENOM_ID, type: "asset", url: "" },
    });

    render(<PromoBanner onContentPress={onContentPress} rail={rail} />);
    const bannerLink = screen.getByRole("link", {
      name: "Promo Banner Test 1",
    });
    expect(bannerLink.props.accessibilityHint).toBe("Opens watch details");
    fireEvent.press(bannerLink);

    expect(onContentPress).toHaveBeenCalledWith(rail, {
      contentType: "vod",
      id: VENOM_ID,
      title: "Promo Banner Test 1",
    });
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  test("is a plain image when the SDK gives no destination, even with a GO link", () => {
    render(
      <PromoBanner
        rail={createPromoRail({
          externalFlags: ["https://links-ze7rte3t.go.synamedia.com/short/Nskq"],
        })}
      />,
    );

    fireEvent.press(screen.getByRole("image", { name: "Promo Banner Test 1" }));

    expect(screen.queryByRole("link")).toBeNull();
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  test.each([
    ["no image", []],
    [
      "an image without a size",
      [{ mimeType: "image/png", url: "https://images.test/promo.png" }],
    ],
  ])("hides the banner when GO sends %s", (_, media) => {
    render(<PromoBanner rail={createPromoRail({ media })} />);

    expect(screen.queryByTestId("promo-banner")).toBeNull();
  });

  test("hides the banner when its image fails to load", () => {
    render(<PromoBanner rail={createPromoRail()} />);

    fireEvent(getImage(), "error", { nativeEvent: { error: "Image failed" } });

    expect(screen.queryByTestId("promo-banner")).toBeNull();
  });
});
