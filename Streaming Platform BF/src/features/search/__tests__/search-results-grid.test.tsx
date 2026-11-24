import type { ContentItem } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SearchResultsGrid } from "@/features/search";

const METRICS = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

const VOD_ITEM: ContentItem = {
  contentType: "standalone",
  id: "vod-1",
  title: "Military History",
};

function renderGrid(
  overrides: Partial<React.ComponentProps<typeof SearchResultsGrid>> = {},
) {
  const props: React.ComponentProps<typeof SearchResultsGrid> = {
    channels: [],
    error: null,
    isLoading: false,
    items: [VOD_ITEM],
    nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
    onResultPress: jest.fn(),
    onRetry: jest.fn(),
    submittedQuery: "mil",
    ...overrides,
  };

  return {
    ...render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SearchResultsGrid {...props} />
      </SafeAreaProvider>,
    ),
    props,
  };
}

describe("SearchResultsGrid", () => {
  it("does not render before a search or for an empty successful result", () => {
    const beforeSearch = renderGrid({ submittedQuery: null });

    expect(beforeSearch.queryByTestId("search-results")).toBeNull();
    beforeSearch.unmount();

    const empty = renderGrid({ items: [] });

    expect(empty.queryByTestId("search-results")).toBeNull();
  });

  it("replaces previous content with a loading grid", () => {
    const { getByTestId, queryByText } = renderGrid({ isLoading: true });

    expect(getByTestId("search-results-loading")).toBeTruthy();
    expect(queryByText("Military History")).toBeNull();
  });

  it("renders actionable content tiles", () => {
    const { getByLabelText, getByText, props } = renderGrid();

    expect(getByText("Search Results")).toBeTruthy();
    fireEvent.press(getByLabelText("Military History"));

    expect(props.onResultPress).toHaveBeenCalledWith({
      assetId: "vod-1",
      kind: "vod",
    });
  });

  it("shows an accessible retry treatment after a request failure", () => {
    const { getByRole, getByTestId, props } = renderGrid({
      error: new Error("offline"),
      items: [],
    });

    expect(getByRole("alert")).toHaveTextContent(
      "We couldn't load your search results.",
    );
    fireEvent.press(getByTestId("search-results-retry"));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });
});
