import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { StyleSheet } from "react-native";

import type { ChannelRailTile } from "@/features/content-rails";
import { ChannelsRail } from "@/features/live-channels/components/channels-rail/channels-rail";

const tiles: ChannelRailTile[] = [
  {
    channel: { id: "bbc-one", name: "BBC One" },
    id: "item-1",
    media: {
      contentFit: "contain",
      url: "https://images.example/bbc-one-square.png",
    },
    name: "BBC One",
  },
  {
    channel: { id: "bbc-two", name: "BBC Two" },
    id: "item-2",
    media: {
      contentFit: "cover",
      url: "https://images.example/bbc-two-square.png",
    },
    name: "BBC Two",
  },
];

const tileWithoutImage: ChannelRailTile = {
  channel: { id: "bbc-three", name: "BBC Three" },
  id: "item-3",
  name: "BBC Three",
};

function renderRail(overrides: Partial<ComponentProps<typeof ChannelsRail>>) {
  return render(
    <ChannelsRail
      isLoading={false}
      isTablet={false}
      memoryKey="home:channels"
      tiles={tiles}
      {...overrides}
    />,
  );
}

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, number>;
}

function firstTileImage() {
  const [image] = screen.getAllByTestId("channel-tile-image");

  if (!image) {
    throw new Error("the rail rendered no tile images");
  }

  return image;
}

function failFirstImage() {
  fireEvent(firstTileImage(), "error", {
    nativeEvent: { error: "not found" },
  });
}

describe("ChannelsRail", () => {
  test("renders the rail title and a tile per item", () => {
    renderRail({});

    expect(screen.getByText("Channels")).toBeTruthy();
    expect(screen.getByLabelText("BBC One")).toBeTruthy();
    expect(screen.getByLabelText("BBC Two")).toBeTruthy();
  });

  test("calls onTilePress with the tile's channel", () => {
    const onTilePress = jest.fn();

    renderRail({ onTilePress });
    fireEvent.press(screen.getByLabelText("BBC Two"));

    expect(onTilePress).toHaveBeenCalledWith(tiles[1]?.channel);
  });

  test.each([
    ["a phone", { isLandscape: false, isTablet: false }, 168],
    ["a tablet in portrait", { isLandscape: false, isTablet: true }, 173],
    ["a tablet in landscape", { isLandscape: true, isTablet: true }, 193],
  ])("sizes the tile and media frame for %s", (_name, layout, tileWidth) => {
    renderRail(layout);

    const tileStyle = flatten(screen.getByLabelText("BBC One").props.style);
    const logoStyle = flatten(firstTileImage().props.style);

    expect(tileStyle.width).toBe(tileWidth);
    expect(
      flatten(screen.getAllByTestId("channel-tile-media-frame")[0]?.props.style)
        .aspectRatio,
    ).toBe(1);
    expect(logoStyle).toMatchObject({ bottom: 0, left: 0, right: 0, top: 0 });
    expect(firstTileImage().props.contentFit).toBe("contain");
  });

  test("uses the landscape frame and the tile's requested media fit", () => {
    renderRail({ presentation: { size: "standard", variant: "landscape" } });

    expect(flatten(screen.getByLabelText("BBC One").props.style).width).toBe(
      168,
    );
    expect(
      flatten(screen.getAllByTestId("channel-tile-media-frame")[0]?.props.style)
        .aspectRatio,
    ).toBe(16 / 9);
    expect(firstTileImage().props.contentFit).toBe("contain");
  });

  test("renders a skeleton while loading, holding the rail's place", () => {
    renderRail({ isLoading: true, tiles: [] });

    expect(screen.getByTestId("content-rail-skeleton")).toBeTruthy();
    expect(screen.getByText("Channels")).toBeTruthy();
  });

  test("renders nothing once loaded with no tiles", () => {
    renderRail({ tiles: [] });

    expect(screen.queryByText("Channels")).toBeNull();
  });

  test("shows the name when the tile carries no image", () => {
    renderRail({ tiles: [tileWithoutImage] });

    expect(screen.getByText("BBC Three")).toBeTruthy();
    expect(screen.queryByTestId("channel-tile-image")).toBeNull();
  });

  test("falls back to the name when a tile's image fails to load", () => {
    renderRail({});
    failFirstImage();

    expect(screen.getByText("Channels")).toBeTruthy();
    expect(screen.getByTestId("channel-tile-name")).toBeTruthy();
    expect(screen.getAllByTestId("channel-tile-image")).toHaveLength(1);
  });
});
