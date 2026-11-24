import { ContentCategoryTemplate, type ContentRail } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

jest.mock("expo-router", () => ({
  // Mirror the real hook, which runs the effect and its cleanup, so the
  // restore timers never outlive a test.
  useFocusEffect: (effect: () => undefined | (() => void)) => {
    require("react").useEffect(effect, [effect]);
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { ContentGrid } from "@/features/content-rails";
import type { GridPagination } from "@/features/content-rails/components/content-grid/content-grid";

function buildRail(itemCount: number): ContentRail {
  return createRail({
    category: createCategory({ id: "vod-rail", name: "Popular Films" }),
    items: Array.from({ length: itemCount }, (_, index) => ({
      id: `tile-${index + 1}`,
      title: `Tile ${index + 1}`,
    })),
  });
}

function buildPagination(overrides: Partial<GridPagination> = {}) {
  return {
    hasError: false,
    isLoadingNextPage: false,
    items: buildRail(4).items ?? [],
    onEndReached: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  };
}

import { createCategory, createRail } from "../../__fixtures__/content";

describe("<ContentGrid />", () => {
  test("renders the rail title at the top of the page", () => {
    const { getByText } = render(<ContentGrid rail={buildRail(4)} />);

    getByText("Popular Films");
  });

  test("keeps the header's gap when the list scrolls", () => {
    const { getByTestId } = render(<ContentGrid rail={buildRail(40)} />);

    const listStyle = StyleSheet.flatten(
      getByTestId("content-grid-scroll").props.style,
    );

    expect(listStyle.marginTop).toBe(24);
    expect(
      getByTestId("content-grid-scroll").props.contentContainerStyle.paddingTop,
    ).toBeUndefined();
  });

  test("announces the rail title as the page heading", () => {
    const { getByRole } = render(<ContentGrid rail={buildRail(4)} />);

    expect(getByRole("header", { name: "Popular Films" })).toBeTruthy();
  });

  test("takes the reader back from the header", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ContentGrid onClose={onClose} rail={buildRail(4)} />,
    );

    fireEvent.press(getByLabelText("Back"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("opens where the rail ran out of tiles", () => {
    const openedAt = (rail: ContentRail) =>
      render(<ContentGrid rail={rail} />).getByTestId("content-grid-scroll")
        .props.contentOffset.y;

    const shortRail = buildRail(4);
    const longRail = buildRail(40);
    const cappedRail: ContentRail = {
      ...longRail,
      contentDisplay: { maxItems: 10 },
    };

    expect(openedAt(shortRail)).toBe(0);
    expect(openedAt(longRail)).toBeGreaterThan(0);
    expect(openedAt(cappedRail)).toBeLessThan(openedAt(longRail));
  });

  test("asks for the next page when the scroll reaches the end", () => {
    const pagination = buildPagination();
    const { getByTestId } = render(
      <ContentGrid pagination={pagination} rail={buildRail(4)} />,
    );
    const list = getByTestId("content-grid-scroll");

    fireEvent(list, "layout", {
      nativeEvent: { layout: { height: 600, width: 375 } },
    });
    fireEvent(list, "contentSizeChange", 375, 1000);
    fireEvent.scroll(list, {
      nativeEvent: {
        contentOffset: { x: 0, y: 900 },
        contentSize: { height: 1000, width: 375 },
        layoutMeasurement: { height: 600, width: 375 },
      },
    });

    expect(pagination.onEndReached).toHaveBeenCalledTimes(1);
  });

  test("leaves the next page alone while the end is out of reach", () => {
    const pagination = buildPagination();
    const { getByTestId } = render(
      <ContentGrid pagination={pagination} rail={buildRail(4)} />,
    );

    fireEvent.scroll(getByTestId("content-grid-scroll"), {
      nativeEvent: {
        contentOffset: { x: 0, y: 0 },
        contentSize: { height: 4000, width: 375 },
        layoutMeasurement: { height: 600, width: 375 },
      },
    });

    expect(pagination.onEndReached).not.toHaveBeenCalled();
  });

  test("keeps the loaded tiles and offers a retry when a page fails", () => {
    const pagination = buildPagination({ hasError: true });
    const { getByTestId, getByText } = render(
      <ContentGrid pagination={pagination} rail={buildRail(0)} />,
    );

    getByText("Tile 1");
    fireEvent.press(getByTestId("content-grid-next-page-retry"));

    expect(pagination.onRetry).toHaveBeenCalledTimes(1);
  });

  test("shows a pulsing placeholder row while the next page loads", () => {
    const { getByTestId } = render(
      <ContentGrid
        pagination={buildPagination({ isLoadingNextPage: true })}
        rail={buildRail(4)}
      />,
    );

    getByTestId("content-grid-next-page-loading");
  });

  test("swaps the retry row for the placeholder while the retry runs", () => {
    const { getByTestId, queryByTestId } = render(
      <ContentGrid
        pagination={buildPagination({
          hasError: true,
          isLoadingNextPage: true,
        })}
        rail={buildRail(4)}
      />,
    );

    getByTestId("content-grid-next-page-loading");
    expect(queryByTestId("content-grid-next-page-retry")).toBeNull();
  });

  test("comes back to where the reader was, not to the rail's row", () => {
    const rail = buildRail(40);
    const first = render(<ContentGrid rail={rail} />);
    const initialOffset = first.getByTestId("content-grid-scroll").props
      .contentOffset.y;

    fireEvent(first.getByTestId("content-grid-scroll"), "scrollBeginDrag");
    fireEvent(first.getByTestId("content-grid-scroll"), "scrollEndDrag", {
      nativeEvent: {
        contentOffset: { x: 0, y: 1800 },
        contentSize: { height: 6000, width: 375 },
        layoutMeasurement: { height: 800, width: 375 },
      },
    });
    first.unmount();

    const second = render(<ContentGrid rail={rail} />);

    expect(
      second.getByTestId("content-grid-scroll").props.contentOffset.y,
    ).toBe(1800);
    expect(initialOffset).not.toBe(1800);
  });

  test("holds a cover while it settles back into place", () => {
    const rail = buildRail(40);
    const first = render(<ContentGrid rail={rail} />);

    fireEvent(first.getByTestId("content-grid-scroll"), "scrollBeginDrag");
    fireEvent.scroll(first.getByTestId("content-grid-scroll"), {
      nativeEvent: {
        contentOffset: { x: 0, y: 2400 },
        contentSize: { height: 6000, width: 375 },
        layoutMeasurement: { height: 800, width: 375 },
      },
    });
    first.unmount();

    const second = render(<ContentGrid rail={rail} />);

    expect(
      second.getByTestId("content-grid-scroll-cover").props.style.opacity,
    ).not.toBe(0);
  });

  test("ignores a list reset that fires while the screen goes away", () => {
    const rail = buildRail(40);
    const first = render(<ContentGrid rail={rail} />);

    fireEvent(first.getByTestId("content-grid-scroll"), "scrollBeginDrag");
    fireEvent(first.getByTestId("content-grid-scroll"), "scrollEndDrag", {
      nativeEvent: {
        contentOffset: { x: 0, y: 1500 },
        contentSize: { height: 6000, width: 375 },
        layoutMeasurement: { height: 800, width: 375 },
      },
    });
    fireEvent.scroll(first.getByTestId("content-grid-scroll"), {
      nativeEvent: {
        contentOffset: { x: 0, y: 0 },
        contentSize: { height: 6000, width: 375 },
        layoutMeasurement: { height: 800, width: 375 },
      },
    });
    first.unmount();

    const second = render(<ContentGrid rail={rail} />);

    expect(
      second.getByTestId("content-grid-scroll").props.contentOffset.y,
    ).toBe(1500);
  });

  test("renders the pagination items rather than the cached rail", () => {
    const { getByText, queryByText } = render(
      <ContentGrid
        pagination={buildPagination({ items: buildRail(2).items ?? [] })}
        rail={buildRail(9)}
      />,
    );

    getByText("Tile 2");
    expect(queryByText("Tile 9")).toBeNull();
  });

  test("filters non-playable items from a vertical grid", () => {
    const rail = {
      ...buildRail(0),
      template: ContentCategoryTemplate.NINE_BY_SIXTEEN_STANDARD,
    };
    const pagination = buildPagination({
      items: [
        {
          contentType: "standalone",
          id: "playable-short",
          title: "Playable short",
        },
        { contentType: "show", id: "show", title: "Show" },
      ],
    });
    const { getByText, queryByText } = render(
      <ContentGrid pagination={pagination} rail={rail} />,
    );

    getByText("Playable short");
    expect(queryByText("Show")).toBeNull();
  });

  test("keeps square View All tiles on the existing landscape treatment", () => {
    const rail = {
      ...buildRail(1),
      template: ContentCategoryTemplate.SQUARE_LARGE,
    };
    const { getByRole } = render(<ContentGrid rail={rail} />);
    const artwork = getByRole("button", { name: "Tile 1" }).children[0];

    expect(StyleSheet.flatten(artwork.props.style).aspectRatio).toBe(16 / 9);
  });

  test("passes the rail and tile to onTilePress", () => {
    const onTilePress = jest.fn();
    const rail = buildRail(4);
    const { getByText } = render(
      <ContentGrid onTilePress={onTilePress} rail={rail} />,
    );

    fireEvent.press(getByText("Tile 1"));

    expect(onTilePress).toHaveBeenCalledWith(rail, rail.items?.[0]);
  });
});
