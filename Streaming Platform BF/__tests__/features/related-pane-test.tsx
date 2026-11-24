import type { ContentItem } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/features/watch-details/hooks/use-related-assets", () => ({
  useRelatedAssets: () => ({
    isError: false,
    isLoading: false,
    items: [
      { contentType: "standalone", id: "vod-2", title: "Second" },
      {
        contentType: "show",
        id: "show-9~vod",
        showId: "show-9",
        title: "Another show",
      },
    ] as ContentItem[],
  }),
}));

const { RelatedPane } =
  require("@/features/watch-details/components/related-pane/related-pane") as typeof import("@/features/watch-details/components/related-pane/related-pane");
const { TabletRelatedPane } =
  require("@/features/watch-details/components/watch-details-tablet/tablet-related-pane") as typeof import("@/features/watch-details/components/watch-details-tablet/tablet-related-pane");
const { SeriesRelatedPane } =
  require("@/features/watch-details/components/series-related-pane/series-related-pane") as typeof import("@/features/watch-details/components/series-related-pane/series-related-pane");

const asset = { id: "vod-1", title: "First" } as ContentItem;

describe("related panes", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test("stacks a phone recommendation on the tab the details page sits in", () => {
    const { getByText } = render(<RelatedPane asset={asset} />);

    fireEvent.press(getByText("Second"));

    expect(mockPush).toHaveBeenCalledWith("./vod-2");
  });

  test("stacks a tablet recommendation on the tab the details page sits in", () => {
    const { getByText } = render(<TabletRelatedPane asset={asset} />);

    fireEvent.press(getByText("Second"));

    expect(mockPush).toHaveBeenCalledWith("./vod-2");
  });

  test("on a series, a show opens its series page and a film its VOD page", () => {
    const { getByText } = render(
      <SeriesRelatedPane isTablet={false} show={asset} showId="show-1" />,
    );

    fireEvent.press(getByText("Another show"));

    expect(mockPush).toHaveBeenLastCalledWith("../show/show-9");

    fireEvent.press(getByText("Second"));

    expect(mockPush).toHaveBeenLastCalledWith("../watch/vod-2");
  });
});
