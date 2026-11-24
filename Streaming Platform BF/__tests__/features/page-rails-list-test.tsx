import { ContentCategoryTemplate } from "@bfbs/common-sdk";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PageRailsList } from "@/features/content-rails";
import type { PageRail } from "@/features/content-rails/types";
import { DEFAULT_RAIL_ITEM_LIMIT } from "@/features/content-rails/utils/rail-content";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));

jest.mock("@/features/content-rails/hooks/use-rail-items", () => ({
  useRailItems: (rail: { items?: unknown[] }) => ({
    hasInitialLoadError: false,
    items: rail.items ?? [],
    loadNextPage: jest.fn(),
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest
  .spyOn(require("react-native"), "useWindowDimensions")
  .mockReturnValue({ fontScale: 1, height: 844, scale: 3, width: 390 });

const RAW_LIVE_ERROR =
  "Request failed due to a network error: GET https://api.example/channels?isPlayable=true&clientToken=SECRET_TOKEN";

const liveRail: PageRail = {
  channels: [{ id: "channel-1", name: "BBC One" }],
  error: null,
  id: "live-1",
  isLoading: false,
  kind: "live-channels",
  presentation: { size: "large", variant: "landscape" },
  title: "All The Channels",
};

function buildVodRail(itemCount: number) {
  const rail = createRail({
    category: createCategory({ id: "vod-1", name: "Popular Films" }),
    items: Array.from({ length: itemCount }, (_, index) => ({
      contentType: "vod",
      id: `tile-${index + 1}`,
      title: `Tile ${index + 1}`,
    })),
  });

  return { id: rail.category.id, kind: "content" as const, placement: rail };
}

import { createCategory, createRail } from "../../__fixtures__/content";

describe("PageRailsList", () => {
  test("carries the scroll cover, so every rails screen recovers its position", () => {
    render(<PageRailsList rails={[liveRail]} />);

    expect(screen.getByTestId("page-rails-scroll-cover")).toBeTruthy();
  });

  test("still hands View All to the caller while arming the restore", () => {
    const onViewAllPress = jest.fn();
    const rail = buildVodRail(DEFAULT_RAIL_ITEM_LIMIT + 1);

    render(<PageRailsList onViewAllPress={onViewAllPress} rails={[rail]} />);

    fireEvent.press(screen.getByLabelText("View All"));

    expect(onViewAllPress).toHaveBeenCalledWith(rail.placement);
  });

  test("routes category tiles through their provider category id", () => {
    const onContentTilePress = jest.fn();
    const placement = createRail({
      category: createCategory({ id: "genres", name: "Genres" }),
      items: [
        {
          categoryId: "provider-comedy",
          contentType: "category",
          id: "comedy-tile",
          media: [{ mimeType: "image/jpeg", url: "https://images/comedy.jpg" }],
          title: "Comedy",
        },
      ],
      template: ContentCategoryTemplate.SQUARE_LARGE,
    });

    render(
      <PageRailsList
        onContentTilePress={onContentTilePress}
        rails={[
          { id: placement.category.id, kind: "category-navigation", placement },
        ]}
      />,
    );

    fireEvent.press(screen.getByLabelText("Comedy"));

    expect(onContentTilePress).toHaveBeenCalledWith(
      placement,
      placement.items?.[0],
    );
  });

  test("opens a Hero item through the page's tile press", () => {
    const onContentTilePress = jest.fn();
    const placement = createRail({
      category: createCategory({ id: "FeaturedHome", name: "FeaturedHome" }),
      items: [{ contentType: "vod", id: "hero-1", title: "Carrie" }],
    });

    render(
      <PageRailsList
        onContentTilePress={onContentTilePress}
        rails={[
          {
            id: placement.category.id,
            kind: "hero",
            liveChannels: {},
            placement,
          },
        ]}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Carrie" }));

    expect(onContentTilePress).toHaveBeenCalledWith(
      placement,
      placement.items?.[0],
    );
  });

  test("plays a live Hero pick through the page's live tile press", () => {
    const onContentTilePress = jest.fn();
    const onLiveTilePress = jest.fn();
    const channel = {
      currentProgramme: { id: "programme-1", title: "The Office" },
      id: "BFBSTV_EX",
      name: "BFBS Extra",
    };
    const placement = createRail({
      category: createCategory({ id: "HomeHero", name: "Home Hero" }),
      items: [{ contentType: "channel", id: "BFBSTV_EX", title: "BFBS Extra" }],
    });

    render(
      <PageRailsList
        onContentTilePress={onContentTilePress}
        onLiveTilePress={onLiveTilePress}
        rails={[
          {
            id: placement.category.id,
            kind: "hero",
            liveChannels: { BFBSTV_EX: channel },
            placement,
          },
        ]}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "The Office" }));

    expect(onLiveTilePress).toHaveBeenCalledWith(channel);
    expect(onContentTilePress).not.toHaveBeenCalled();
  });

  test("keeps a caller's scroll handler alongside the restore", () => {
    const onScroll = jest.fn();

    render(
      <PageRailsList
        listProps={{ onScroll, testID: "rails-list" }}
        rails={[liveRail]}
      />,
    );

    fireEvent.scroll(screen.getByTestId("rails-list"), {
      nativeEvent: {
        contentOffset: { x: 0, y: 120 },
        contentSize: { height: 2000, width: 390 },
        layoutMeasurement: { height: 800, width: 390 },
      },
    });

    expect(onScroll).toHaveBeenCalledTimes(1);
  });

  test("hides the live rail and never renders the raw error when the live query fails", () => {
    render(<PageRailsList rails={[{ ...liveRail, error: RAW_LIVE_ERROR }]} />);

    expect(screen.queryByText("All The Channels")).toBeNull();
    expect(screen.queryByText(RAW_LIVE_ERROR)).toBeNull();
    expect(screen.queryByText(/clientToken/)).toBeNull();
  });

  test("renders the live rail when there is no error", () => {
    render(<PageRailsList rails={[liveRail]} />);

    expect(screen.getByText("All The Channels")).toBeTruthy();
  });
});
