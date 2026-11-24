import type { ContentItem, ContentRail } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockGetCollectionContent = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getCollectionContent: (input: unknown) => mockGetCollectionContent(input),
  },
  ContentCategoryTemplate: {
    SIXTEEN_BY_NINE_STANDARD: "SIXTEEN_BY_NINE_STANDARD",
  },
}));

import {
  RAIL_ITEMS_PAGE_SIZE,
  useRailItems,
} from "@/features/content-rails/hooks/use-rail-items";

const RAIL_ID = "vod-rail";

function buildItems(from: number, count: number): ContentItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${from + index}`,
    title: `Item ${from + index}`,
  }));
}

function buildPage(
  from: number,
  count: number,
  total: number | undefined = count,
) {
  return {
    categoryId: RAIL_ID,
    items: buildItems(from, count),
    metadata: { count, ...(total === undefined ? {} : { total }) },
  };
}

function buildRail(items: ContentItem[] = []): ContentRail {
  return createRail({
    category: createCategory({ id: RAIL_ID, name: "Popular Films" }),
    items,
  });
}

function renderRailItems(rail = buildRail()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useRailItems(rail), { wrapper });
}

import { createCategory, createRail } from "../../__fixtures__/content";

describe("useRailItems", () => {
  beforeEach(() => {
    mockGetCollectionContent.mockReset();
  });

  test("requests the first page for the rail's category", async () => {
    mockGetCollectionContent.mockResolvedValue(buildPage(1, 4, 4));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(4);
    });

    expect(mockGetCollectionContent).toHaveBeenCalledWith({
      categoryId: RAIL_ID,
      limit: RAIL_ITEMS_PAGE_SIZE,
      offset: 0,
    });
  });

  test("reads a page that carries no items as an empty one", async () => {
    mockGetCollectionContent.mockResolvedValue({
      categoryId: RAIL_ID,
      metadata: { count: 0, total: 0 },
    });

    const { result } = renderRailItems(buildRail(buildItems(1, 3)));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(0);
    });

    expect(result.current.hasError).toBe(false);
  });

  test("keeps paging from the loaded count when metadata is missing", async () => {
    mockGetCollectionContent
      .mockResolvedValueOnce({
        categoryId: RAIL_ID,
        items: buildItems(1, RAIL_ITEMS_PAGE_SIZE),
      })
      .mockResolvedValueOnce(buildPage(RAIL_ITEMS_PAGE_SIZE + 1, 1, undefined));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
    });

    act(() => {
      result.current.loadNextPage();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE + 1);
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(2);
  });

  test("shows the rail's cached items until the first page arrives", () => {
    mockGetCollectionContent.mockReturnValue(new Promise(() => undefined));

    const { result } = renderRailItems(buildRail(buildItems(1, 3)));

    expect(result.current.items).toHaveLength(3);
  });

  test("loads the next page from the loaded count", async () => {
    const total = RAIL_ITEMS_PAGE_SIZE + 5;
    mockGetCollectionContent
      .mockResolvedValueOnce(buildPage(1, RAIL_ITEMS_PAGE_SIZE, total))
      .mockResolvedValueOnce(buildPage(RAIL_ITEMS_PAGE_SIZE + 1, 5, total));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenLastCalledWith({
      categoryId: RAIL_ID,
      limit: RAIL_ITEMS_PAGE_SIZE,
      offset: RAIL_ITEMS_PAGE_SIZE,
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(total);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(2);
  });

  test("stops paging when a provider that reports no total sends a short page", async () => {
    mockGetCollectionContent.mockResolvedValue(
      buildPage(1, RAIL_ITEMS_PAGE_SIZE - 1, undefined),
    );

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE - 1);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(1);
  });

  test("stops paging once it holds everything the provider reports", async () => {
    mockGetCollectionContent.mockResolvedValue(
      buildPage(1, RAIL_ITEMS_PAGE_SIZE, RAIL_ITEMS_PAGE_SIZE),
    );

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(1);
  });

  test("keeps paging when the provider caps a page below the requested size", async () => {
    const total = RAIL_ITEMS_PAGE_SIZE * 2;
    const cappedPageSize = RAIL_ITEMS_PAGE_SIZE - 10;
    mockGetCollectionContent
      .mockResolvedValueOnce(buildPage(1, cappedPageSize, total))
      .mockResolvedValueOnce(
        buildPage(cappedPageSize + 1, cappedPageSize, total),
      );

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(cappedPageSize);
    });

    act(() => {
      result.current.loadNextPage();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(cappedPageSize * 2);
    });

    expect(mockGetCollectionContent).toHaveBeenLastCalledWith({
      categoryId: RAIL_ID,
      limit: RAIL_ITEMS_PAGE_SIZE,
      offset: cappedPageSize,
    });
  });

  test("stops paging when a page comes back empty", async () => {
    mockGetCollectionContent.mockResolvedValue(buildPage(1, 0, 90));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(mockGetCollectionContent).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(1);
  });

  test("refetches the first page when it is the one that failed", async () => {
    mockGetCollectionContent.mockRejectedValueOnce(new Error("offline"));

    const { result } = renderRailItems(buildRail(buildItems(1, 2)));

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    expect(result.current.items).toHaveLength(2);

    mockGetCollectionContent.mockResolvedValueOnce(buildPage(1, 4, 4));

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(4);
    });
  });

  test("keeps the loaded items when a later page fails", async () => {
    mockGetCollectionContent
      .mockResolvedValueOnce(
        buildPage(1, RAIL_ITEMS_PAGE_SIZE, RAIL_ITEMS_PAGE_SIZE * 2),
      )
      .mockRejectedValueOnce(new Error("offline"));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
    });

    act(() => {
      result.current.loadNextPage();
    });

    await waitFor(() => {
      expect(result.current.hasError).toBe(true);
    });

    act(() => {
      result.current.loadNextPage();
    });

    expect(mockGetCollectionContent).toHaveBeenCalledTimes(2);
    expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
  });

  test("drops items the provider repeats across pages", async () => {
    const total = RAIL_ITEMS_PAGE_SIZE + 1;
    mockGetCollectionContent
      .mockResolvedValueOnce(buildPage(1, RAIL_ITEMS_PAGE_SIZE, total))
      .mockResolvedValueOnce(buildPage(RAIL_ITEMS_PAGE_SIZE, 2, total));

    const { result } = renderRailItems();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE);
    });

    act(() => {
      result.current.loadNextPage();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(RAIL_ITEMS_PAGE_SIZE + 1);
    });
  });
});
