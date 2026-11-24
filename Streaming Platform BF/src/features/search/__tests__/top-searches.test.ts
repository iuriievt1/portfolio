jest.mock("@bfbs/common-sdk", () => ({
  ContentSource: { LTV: "ltv", VOD: "vod" },
  Search: { getTopSearches: jest.fn() },
}));

import { Search } from "@bfbs/common-sdk";

import {
  SEARCH_RECOMMENDATION_LIMIT,
  TOP_SEARCHES_QUERY_KEY,
  topSearchesQueryOptions,
} from "@/features/search";

describe("topSearchesQueryOptions", () => {
  it("requests and caches the 15 recommended VOD and live-TV items", async () => {
    jest.mocked(Search.getTopSearches).mockResolvedValue({
      items: [],
      metadata: { count: 0, total: 0 },
    });
    const options = topSearchesQueryOptions();

    if (typeof options.queryFn !== "function") {
      throw new Error("Expected a Top Search query function.");
    }

    await options.queryFn({} as never);

    expect(Search.getTopSearches).toHaveBeenCalledWith({
      limit: SEARCH_RECOMMENDATION_LIMIT,
      sources: ["vod", "ltv"],
    });
    expect(SEARCH_RECOMMENDATION_LIMIT).toBe(15);
    expect(options.queryKey).toEqual(TOP_SEARCHES_QUERY_KEY);
  });
});
