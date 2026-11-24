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

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

import { Search, type SearchResultSet } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { SEARCH_DEBOUNCE_MS, useSearchResults } from "@/features/search";
import { reportError } from "@/infra/error";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createResult(query: string, itemIds: string[] = []): SearchResultSet {
  return {
    items: itemIds.map((id) => ({ id, title: `Title ${id}` })),
    metadata: { count: itemIds.length, total: itemIds.length },
    query,
  };
}

function mockCombinedResult(
  vodResult: SearchResultSet,
  liveResult = createResult(vodResult.query),
) {
  jest
    .mocked(Search.getSearchResultsForTerm)
    .mockImplementation(({ sources }) =>
      Promise.resolve(sources?.[0] === "vod" ? vodResult : liveResult),
    );
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function advanceDebounce() {
  await act(async () => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
  });
}

describe("useSearchResults", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not search invalid terms", async () => {
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery(" ab ");
      result.current.submitQuery(" ab ");
    });
    await advanceDebounce();

    expect(Search.getSearchResultsForTerm).not.toHaveBeenCalled();
    expect(result.current.submittedQuery).toBeNull();
    expect(result.current.items).toEqual([]);
  });

  it("restarts the debounce and only submits the latest trimmed term", async () => {
    mockCombinedResult(createResult("forces"));
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("for");
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
      result.current.setDraftQuery("  forces  ");
    });
    await advanceDebounce();

    expect(Search.getSearchResultsForTerm).toHaveBeenCalledTimes(2);
    expect(Search.getSearchResultsForTerm).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collapsed: true,
        sources: ["vod"],
        term: "forces",
      }),
    );
    expect(Search.getSearchResultsForTerm).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collapsed: false,
        sources: ["ltv"],
        term: "forces",
      }),
    );
  });

  it("submits immediately and cancels the pending debounce", async () => {
    mockCombinedResult(createResult("forces"));
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("forces");
    });
    act(() => {
      result.current.submitQuery("forces");
    });

    await waitFor(() => {
      expect(Search.getSearchResultsForTerm).toHaveBeenCalledTimes(2);
    });

    await advanceDebounce();
    expect(Search.getSearchResultsForTerm).toHaveBeenCalledTimes(2);
  });

  it("exposes successful and empty result states with metadata", async () => {
    mockCombinedResult(createResult("forces"));
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("forces");
    });
    await advanceDebounce();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isEmpty).toBe(true);
    });
    expect(result.current.metadata).toEqual({ count: 0, total: 0 });
    expect(result.current.error).toBeNull();
  });

  it("clears submitted and result state when the draft becomes too short", async () => {
    mockCombinedResult(createResult("forces", ["result-1"]));
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("forces");
    });
    await advanceDebounce();
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.setDraftQuery("fo");
    });

    expect(result.current.submittedQuery).toBeNull();
    expect(result.current.items).toEqual([]);
    expect(result.current.metadata).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });

  it("reports failures and retries the current term without changing the draft", async () => {
    const searchError = new Error("Search failed");
    let hasFailedHistoryRequest = false;
    jest
      .mocked(Search.getSearchResultsForTerm)
      .mockImplementation(({ sources, term }) => {
        if (term === "forces") {
          return Promise.resolve(
            sources?.[0] === "vod"
              ? createResult(term, ["older-result"])
              : createResult(term),
          );
        }

        if (sources?.[0] === "vod" && !hasFailedHistoryRequest) {
          hasFailedHistoryRequest = true;
          return Promise.reject(searchError);
        }

        return Promise.resolve(
          sources?.[0] === "vod"
            ? createResult(term, ["current-result"])
            : createResult(term),
        );
      });
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("forces");
    });
    await advanceDebounce();
    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe("older-result");
    });

    act(() => {
      result.current.setDraftQuery("history");
    });
    await advanceDebounce();

    await waitFor(() => {
      expect(result.current.error).toBe(searchError);
    });
    expect(reportError).toHaveBeenCalledWith(searchError, {
      tags: { area: "search", operation: "get_search_results" },
    });
    expect(result.current.items).toEqual([]);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(Search.getSearchResultsForTerm).toHaveBeenCalledTimes(6);
    expect(result.current.items[0]?.id).toBe("current-result");
    expect(result.current.draftQuery).toBe("history");
  });

  it("ignores an older response that resolves after the current query", async () => {
    const olderVodRequest = createDeferred<SearchResultSet>();
    const olderLiveRequest = createDeferred<SearchResultSet>();
    const currentVodRequest = createDeferred<SearchResultSet>();
    const currentLiveRequest = createDeferred<SearchResultSet>();
    jest
      .mocked(Search.getSearchResultsForTerm)
      .mockImplementation(({ sources, term }) => {
        if (term === "forces") {
          return sources?.[0] === "vod"
            ? olderVodRequest.promise
            : olderLiveRequest.promise;
        }

        return sources?.[0] === "vod"
          ? currentVodRequest.promise
          : currentLiveRequest.promise;
      });
    const { result } = renderHook(useSearchResults, {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDraftQuery("forces");
    });
    await advanceDebounce();
    expect(result.current.isLoading).toBe(true);
    act(() => {
      result.current.setDraftQuery("history");
    });
    await advanceDebounce();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      currentVodRequest.resolve(createResult("history", ["current"]));
      currentLiveRequest.resolve(createResult("history"));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.items[0]?.id).toBe("current");
    });

    await act(async () => {
      olderVodRequest.resolve(createResult("forces", ["older"]));
      olderLiveRequest.resolve(createResult("forces"));
      await Promise.resolve();
    });

    expect(result.current.submittedQuery).toBe("history");
    expect(result.current.items[0]?.id).toBe("current");
  });
});
