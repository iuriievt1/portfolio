import { act, render, screen } from "@testing-library/react-native";
import { Image } from "expo-image";
import { ContentTile } from "@/features/content-rails/components/content-tile/content-tile";
import { PROGRESS_TICK_MS } from "@/features/content-rails/components/content-tile/use-programme-progress";
import type {
  CategoryNavigationRailTile,
  LiveRailTile,
  VodRailTile,
} from "@/features/content-rails/types";
import { TILE_VARIANT } from "@/features/content-rails/utils/tile-metrics";

const PROGRAMME_START_MS = Date.parse("2026-07-20T14:00:00.000Z");
const ONE_HOUR_MS = 60 * 60 * 1000;

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
  progressEndMs: PROGRAMME_START_MS + ONE_HOUR_MS,
  progressStartMs: PROGRAMME_START_MS,
  timeLabel: "Today 14:00",
  title: "Liverpool vs PSG",
};

const vodTile: VodRailTile = {
  contentType: "vod",
  id: "vod-1",
  media: [{ mimeType: "image/jpeg", url: "https://images.test/vod.jpg" }],
  title: "Top Gun: Maverick",
};

const brandedVodTile: VodRailTile = {
  ...vodTile,
  channelMedia: [
    {
      mimeType: "image/png",
      type: "logo",
      url: "https://images.test/logo.png",
    },
  ],
  channelName: "BFBS",
};

const genreTile: CategoryNavigationRailTile = {
  categoryId: "films",
  contentType: "category",
  id: "films",
  media: [{ mimeType: "image/jpeg", url: "https://images.test/films.jpg" }],
  title: "Films",
};

describe("ContentTile scrims", () => {
  test("leaves a plain VOD tile's artwork alone", () => {
    const { queryAllByTestId } = render(
      <ContentTile tile={vodTile} width={168} />,
    );

    expect(queryAllByTestId("content-tile-scrim")).toHaveLength(0);
  });

  test("darkens the top of a VOD tile that carries a channel logo", () => {
    const { queryAllByTestId } = render(
      <ContentTile tile={brandedVodTile} width={168} />,
    );

    expect(queryAllByTestId("content-tile-scrim")).toHaveLength(1);
  });

  test("darkens the bottom of a ranked VOD tile", () => {
    const { queryAllByTestId } = render(
      <ContentTile rank={1} tile={vodTile} width={168} />,
    );

    expect(queryAllByTestId("content-tile-scrim")).toHaveLength(1);
  });

  test("keeps the live tile's own scrims", () => {
    const { queryAllByTestId } = render(
      <ContentTile size="large" tile={liveTile} width={255} />,
    );

    expect(queryAllByTestId("content-tile-scrim").length).toBeGreaterThan(0);
  });
});

describe("ContentTile rendering", () => {
  test("shows and announces duration for a vertical VOD tile", () => {
    render(
      <ContentTile
        tile={{ ...vodTile, durationSeconds: 32 }}
        variant={TILE_VARIANT.VERTICAL}
        width={168}
      />,
    );

    expect(screen.getByTestId("content-tile-duration")).toHaveTextContent(
      "00:32",
    );
    expect(
      screen.getByRole("button", { name: "Top Gun: Maverick, 00:32" }),
    ).toBeTruthy();
  });

  test("does not add Shorts metadata to a landscape VOD tile", () => {
    render(
      <ContentTile tile={{ ...vodTile, durationSeconds: 32 }} width={168} />,
    );

    expect(screen.queryByTestId("content-tile-duration")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Top Gun: Maverick" }),
    ).toBeTruthy();
  });

  test("renders a genre title over square artwork without a caption below", () => {
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <ContentTile
        tile={genreTile}
        variant={TILE_VARIANT.SQUARE_CARD}
        width={168}
      />,
    );

    expect(getByTestId("genre-tile-title").props.children).toBe("Films");
    expect(getAllByTestId("content-tile-scrim")).toHaveLength(2);
    expect(queryByTestId("content-tile-title")).toBeNull();
  });

  test("renders a landscape category-navigation tile without the genre overlay", () => {
    const { getByTestId, queryByTestId } = render(
      <ContentTile tile={genreTile} width={168} />,
    );

    expect(queryByTestId("genre-tile-title")).toBeNull();
    expect(getByTestId("content-tile-title").props.children).toBe("Films");
  });

  test("does not repaint its images when the progress bar ticks", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(PROGRAMME_START_MS + 60_000));

    // expo-image's Image is a PureComponent, so it only repaints when a prop
    // identity changes. A live tile re-renders every tick; nothing it hands the
    // images should change with it.
    const renderSpy = jest.spyOn(Image.prototype as never, "render");

    try {
      render(<ContentTile size="large" tile={liveTile} width={255} />);
      const rendersAfterMount = renderSpy.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(PROGRESS_TICK_MS);
      });

      expect(renderSpy.mock.calls).toHaveLength(rendersAfterMount);
    } finally {
      renderSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
