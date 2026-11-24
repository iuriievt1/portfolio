import type { ContentItem } from "@bfbs/common-sdk";
import { fireEvent, render } from "@testing-library/react-native";
import { RelatedGrid } from "@/features/watch-details/components/related-pane/related-grid";

const items = [
  { contentType: "standalone", id: "vod-1", title: "First" },
  { contentType: "standalone", id: "vod-2", title: "Second" },
] as ContentItem[];

function renderGrid(props: Partial<Parameters<typeof RelatedGrid>[0]> = {}) {
  const onSelect = jest.fn();
  const view = render(
    <RelatedGrid
      className="flex-row flex-wrap"
      columnGap={8}
      columns={2}
      isError={false}
      isLoading={false}
      items={items}
      onSelect={onSelect}
      {...props}
    />,
  );

  return { ...view, onSelect };
}

describe("<RelatedGrid />", () => {
  test("renders a tile per recommendation and reports the choice", () => {
    const { getByText, onSelect } = renderGrid();

    getByText("First");
    fireEvent.press(getByText("Second"));

    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  test("holds the grid shape while loading, so nothing jumps", () => {
    const { getByTestId, queryByTestId } = renderGrid({
      isLoading: true,
      items: [],
    });

    getByTestId("related-grid-loading");
    expect(queryByTestId("related-grid-message")).toBeNull();
  });

  test("explains an empty result", () => {
    const { getByText } = renderGrid({ items: [] });

    getByText("Nothing related to this title yet.");
  });

  test("explains a failed request", () => {
    const { getByText } = renderGrid({ isError: true, items: [] });

    getByText("We couldn't load related titles.");
  });

  test("shows the branded placeholder on a tile without artwork", () => {
    const { getByTestId } = renderGrid({
      items: [
        { contentType: "standalone", id: "vod-3", title: "No artwork" },
      ] as ContentItem[],
    });

    getByTestId("programme-artwork-fallback-image");
  });

  test("keeps showing cached tiles when a refresh fails", () => {
    const { getByText, queryByTestId } = renderGrid({ isError: true });

    getByText("First");
    expect(queryByTestId("related-grid-message")).toBeNull();
  });
});
