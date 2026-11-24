import type { MediaImage } from "@bfbs/common-sdk";
import { render, screen } from "@testing-library/react-native";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import type { VodRailTile } from "@/features/content-rails/types";

jest.mock("expo-image", () => ({ Image: require("react-native").View }));

const ARTWORK: MediaImage[] = [
  {
    height: 720,
    mimeType: "image/jpeg",
    url: "https://example.com/venom.jpg",
    width: 1280,
  },
];

const VENOM: VodRailTile = {
  contentType: "vod",
  id: "venom",
  media: ARTWORK,
  title: "Venom",
};

const VENOM_ON_BFBS_EXTRA: VodRailTile = {
  ...VENOM,
  channelMedia: [
    { mimeType: "image/png", url: "https://example.com/bfbs-extra.png" },
  ],
  channelName: "BFBS Extra",
};

describe("ContentTile", () => {
  it("shows the rank and reads rank, title and channel", () => {
    render(<ContentTile rank={1} tile={VENOM_ON_BFBS_EXTRA} width={168} />);

    expect(screen.getByTestId("content-tile-rank")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Number 1, Venom, BFBS Extra" }),
    ).toBeTruthy();
  });

  it("shows the channel logo when the item has one", () => {
    render(<ContentTile rank={1} tile={VENOM_ON_BFBS_EXTRA} width={168} />);

    expect(screen.getByLabelText("BFBS Extra")).toBeTruthy();
  });

  it("reads rank and title when there is no channel", () => {
    render(<ContentTile rank={2} tile={VENOM} width={168} />);

    expect(
      screen.getByRole("button", { name: "Number 2, Venom" }),
    ).toBeTruthy();
  });

  it("has no rank outside a Top 10 rail", () => {
    render(<ContentTile tile={VENOM} width={168} />);

    expect(screen.queryByTestId("content-tile-rank")).toBeNull();
    expect(screen.getByRole("button", { name: "Venom" })).toBeTruthy();
  });

  it("shows the fallback artwork when there is no usable image", () => {
    const venomWithoutArtwork: VodRailTile = {
      contentType: "vod",
      id: "venom",
      title: "Venom",
    };

    render(<ContentTile rank={3} tile={venomWithoutArtwork} width={168} />);

    expect(screen.getByTestId("programme-artwork-fallback")).toBeTruthy();
  });
});
