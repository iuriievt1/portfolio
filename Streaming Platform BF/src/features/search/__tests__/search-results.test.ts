jest.mock("@bfbs/common-sdk", () => ({
  ContentSource: { LTV: "ltv", VOD: "vod" },
  Search: {
    getSearchResultsForTerm: jest.fn(),
  },
  SearchMatchMode: {
    PREFIX: "PREFIX",
  },
  SearchSortField: {
    DATE: "DATE",
  },
}));

import { Search, SearchMatchMode, SearchSortField } from "@bfbs/common-sdk";
import {
  SEARCH_RESULTS_LIMIT,
  searchResultsQueryOptions,
} from "@/features/search";

describe("searchResultsQueryOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("combines VOD before live results and truncates them to the result limit", async () => {
    const vodItems = Array.from({ length: 20 }, (_, index) => ({
      id: `vod-${index}`,
      title: `VOD ${index}`,
    }));
    const liveItems = Array.from({ length: 20 }, (_, index) => ({
      id: `live-${index}`,
      title: `Live ${index}`,
    }));
    const vodResponse = {
      items: vodItems,
      metadata: { count: 20, total: 25 },
      query: "blue",
    };
    const liveResponse = {
      items: liveItems,
      metadata: { count: 20, total: 30 },
      query: "blue",
    };
    jest
      .mocked(Search.getSearchResultsForTerm)
      .mockResolvedValueOnce(vodResponse)
      .mockResolvedValueOnce(liveResponse);

    const options = searchResultsQueryOptions("  blue  ");
    const query = options.queryFn;

    if (typeof query !== "function") {
      throw new Error("Expected a search query function.");
    }

    const result = await query({} as never);

    expect(Search.getSearchResultsForTerm).toHaveBeenNthCalledWith(1, {
      collapsed: true,
      limit: SEARCH_RESULTS_LIMIT,
      matchMode: SearchMatchMode.PREFIX,
      sources: ["vod"],
      term: "blue",
    });
    expect(Search.getSearchResultsForTerm).toHaveBeenNthCalledWith(2, {
      collapsed: false,
      limit: SEARCH_RESULTS_LIMIT,
      matchMode: SearchMatchMode.PREFIX,
      sort: { field: SearchSortField.DATE },
      sources: ["ltv"],
      term: "blue",
    });
    expect(result).toEqual({
      items: [...vodItems, ...liveItems.slice(0, 10)],
      metadata: { count: 30, total: 55 },
      query: "blue",
    });
    expect(options.queryKey).toEqual([
      "search",
      "results",
      {
        collapsed: true,
        limit: 30,
        matchMode: SearchMatchMode.PREFIX,
        sources: ["vod"],
        term: "blue",
      },
      {
        collapsed: false,
        limit: 30,
        matchMode: SearchMatchMode.PREFIX,
        sort: { field: SearchSortField.DATE },
        sources: ["ltv"],
        term: "blue",
      },
    ]);
  });

  it.each([
    null,
    "",
    "  ",
    "ab",
  ])("does not create a request for invalid term %p", (term) => {
    const options = searchResultsQueryOptions(term);

    expect(typeof options.queryFn).not.toBe("function");
    expect(Search.getSearchResultsForTerm).not.toHaveBeenCalled();
  });
});
