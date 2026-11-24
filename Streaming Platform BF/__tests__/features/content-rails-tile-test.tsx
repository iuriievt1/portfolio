import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import type { LiveRailTile, VodRailTile } from "@/features/content-rails/types";

const vodTile: VodRailTile = {
  contentType: "vod",
  id: "vod-1",
  media: [{ mimeType: "image/jpeg", url: "https://images.test/vod.jpg" }],
  title: "Popular Films 1",
};

const liveTile: LiveRailTile = {
  channelMedia: [
    {
      mimeType: "image/png",
      type: "logo",
      url: "https://images.test/logo.png",
    },
  ],
  channelName: "BBC One",
  contentType: "live",
  id: "channel-1",
  media: [{ mimeType: "image/jpeg", url: "https://images.test/live.jpg" }],
  progressEndMs: Date.parse("2026-07-20T15:00:00.000Z"),
  progressStartMs: Date.parse("2026-07-20T14:00:00.000Z"),
  timeLabel: "Today 14:00",
  title: "Liverpool vs PSG",
};

/** SVG text keeps its value in a prop. */
function getDrawnRank() {
  const [glyphs] = screen.UNSAFE_root.findAll(
    (node: { type: unknown }) =>
      typeof node.type === "string" && node.type.includes("TSpan"),
  );

  return glyphs?.props.content;
}

describe("ContentTile", () => {
  test("renders a vod tile without live overlays", () => {
    render(<ContentTile width={255} tile={vodTile} />);

    expect(screen.getByText("Popular Films 1")).toBeTruthy();
    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.queryByTestId("content-tile-progress")).toBeNull();
  });

  test("shows the channel branding a vod item carries", () => {
    render(
      <ContentTile
        tile={{
          ...vodTile,
          channelMedia: [
            {
              mimeType: "image/png",
              type: "logo",
              url: "https://images.test/bbc-one.png",
            },
          ],
          channelName: "BBC One",
        }}
        width={255}
      />,
    );

    expect(screen.getByLabelText("BBC One")).toBeTruthy();
  });

  test("draws the rank a ranked rail hands it", () => {
    render(<ContentTile rank={3} tile={vodTile} width={255} />);

    expect(screen.getByTestId("content-tile-rank")).toBeTruthy();
    expect(getDrawnRank()).toBe("3");
  });

  test("leaves the corner clear when the rail is not ranked", () => {
    render(<ContentTile tile={vodTile} width={255} />);

    expect(screen.queryByTestId("content-tile-rank")).toBeNull();
  });

  test("renders a live tile with badge, progress and time label", () => {
    render(<ContentTile width={255} tile={liveTile} />);

    expect(screen.getByText("Liverpool vs PSG")).toBeTruthy();
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText("Today 14:00")).toBeTruthy();
    expect(screen.getByTestId("content-tile-progress")).toBeTruthy();
  });

  test("falls back to the branded placeholder when the artwork fails", () => {
    render(<ContentTile width={255} tile={vodTile} />);

    expect(screen.queryByTestId("programme-artwork-fallback")).toBeNull();

    fireEvent(screen.getByTestId("programme-artwork-image"), "error", {
      nativeEvent: { error: "load failed" },
    });

    expect(screen.getByTestId("programme-artwork-fallback-image")).toBeTruthy();
  });

  test("scales the live badge for standard live tiles", () => {
    const { getByTestId: getLargeByTestId } = render(
      <ContentTile size="large" width={255} tile={liveTile} />,
    );
    const largeBadgeStyle = StyleSheet.flatten(
      getLargeByTestId("content-tile-live-badge").props.style,
    );
    const largeDotStyle = StyleSheet.flatten(
      getLargeByTestId("content-tile-live-badge-dot").props.style,
    );

    const { getByTestId: getSmallByTestId } = render(
      <ContentTile size="standard" width={168} tile={liveTile} />,
    );
    const smallBadgeStyle = StyleSheet.flatten(
      getSmallByTestId("content-tile-live-badge").props.style,
    );
    const smallDotStyle = StyleSheet.flatten(
      getSmallByTestId("content-tile-live-badge-dot").props.style,
    );

    expect(smallBadgeStyle.height).toBeLessThan(largeBadgeStyle.height);
    expect(smallBadgeStyle.paddingHorizontal).toBeLessThan(
      largeBadgeStyle.paddingHorizontal,
    );
    expect(smallDotStyle.height).toBeLessThan(largeDotStyle.height);
  });

  test("omits progress and time when the programme is unknown", () => {
    const withoutProgramme: LiveRailTile = {
      channelName: "BBC One",
      contentType: "live",
      id: "channel-2",
      title: "BBC One",
    };

    render(<ContentTile width={255} tile={withoutProgramme} />);

    // With no programme the title falls back to the channel name, so "BBC One"
    // legitimately renders twice (logo fallback + title). Assert each precisely
    // rather than by text, which would match both.
    expect(screen.getByTestId("content-tile-title")).toHaveTextContent(
      "BBC One",
    );
    expect(
      screen.getByTestId("content-tile-channel-fallback"),
    ).toHaveTextContent("BBC One");
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.queryByTestId("content-tile-progress")).toBeNull();
  });

  test("falls back to the channel name when there is no logo", () => {
    const { channelMedia: _channelMedia, ...withoutLogo } = liveTile;

    render(<ContentTile width={255} tile={withoutLogo} />);

    expect(
      screen.getByTestId("content-tile-channel-fallback"),
    ).toHaveTextContent("BBC One");
  });

  test("falls back to the channel name when the logo fails to load", () => {
    render(<ContentTile width={255} tile={liveTile} />);

    // A logo URL is present, so the image renders and there is no text yet.
    expect(screen.queryByTestId("content-tile-channel-fallback")).toBeNull();

    fireEvent(screen.getByLabelText("BBC One"), "error", {
      nativeEvent: { error: "not found" },
    });

    expect(
      screen.getByTestId("content-tile-channel-fallback"),
    ).toHaveTextContent("BBC One");
  });
});
