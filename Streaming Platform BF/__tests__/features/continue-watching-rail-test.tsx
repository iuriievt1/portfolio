import type { ContentItem } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ContinueWatchingRail } from "@/features/content-rails/components/continue-watching-rail/continue-watching-rail";
import { useContinueWatching } from "@/features/continue-watching";
import {
  createCategory,
  createItem,
  createRail,
} from "../../__fixtures__/content";

const mockGetContinueWatchingList = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
  ContentSource: { VOD: "vod" },
  ContinueWatchingRecentSource: { PARTIALLY_VIEWED: "partiallyViewed" },
  UserProfile: {
    getContinueWatchingList: (input: unknown) =>
      mockGetContinueWatchingList(input),
  },
}));

const pageRail = createRail({
  category: createCategory({ id: "Continue", name: "Continue Watching" }),
  items: [
    createItem({ contentType: "vod", id: "page-1", title: "From the page" }),
  ],
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderRail(queryClient = createQueryClient()) {
  return render(<ContinueWatchingRail isTablet={false} rail={pageRail} />, {
    wrapper: createWrapper(queryClient),
  });
}

function listOf(items: ContentItem[]) {
  return { items, metadata: { count: items.length, total: items.length } };
}

beforeEach(() => {
  mockGetContinueWatchingList.mockReset();
});

describe("useContinueWatching", () => {
  test("asks GO for partially watched VOD, up to 30", async () => {
    mockGetContinueWatchingList.mockResolvedValue(listOf([]));

    renderHook(() => useContinueWatching(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => {
      expect(mockGetContinueWatchingList).toHaveBeenCalledWith({
        limit: 30,
        recentSource: "partiallyViewed",
        sources: ["vod"],
      });
    });
  });
});

describe("<ContinueWatchingRail />", () => {
  test("keeps the order GO sends", async () => {
    mockGetContinueWatchingList.mockResolvedValue(
      listOf([
        createItem({ contentType: "vod", id: "b", title: "Newest" }),
        createItem({ contentType: "vod", id: "a", title: "Older" }),
        createItem({ contentType: "vod", id: "c", title: "Oldest" }),
      ]),
    );

    renderRail();
    await screen.findByText("Newest");

    expect(
      screen
        .getAllByTestId("content-tile-title")
        .map((title) => title.props.children),
    ).toEqual(["Newest", "Older", "Oldest"]);
  });

  test("hides the whole rail, heading included, when the list is empty", async () => {
    mockGetContinueWatchingList.mockResolvedValue(listOf([]));

    renderRail();

    await waitFor(() => {
      expect(screen.queryByText("Continue Watching")).toBeNull();
    });
    expect(screen.toJSON()).toBeNull();
  });

  test("keeps the page's items if the request fails", async () => {
    const queryClient = createQueryClient();
    mockGetContinueWatchingList.mockRejectedValue(new Error("offline"));

    renderRail(queryClient);

    await waitFor(() => {
      expect(queryClient.getQueryState(["continue-watching"])?.status).toBe(
        "error",
      );
    });
    expect(screen.getByText("Continue Watching")).toBeTruthy();
    expect(screen.getByText("From the page")).toBeTruthy();
  });

  test("shows the fallback artwork for an item without an image", async () => {
    mockGetContinueWatchingList.mockResolvedValue(
      listOf([
        createItem({ contentType: "vod", id: "no-art", title: "No Art" }),
      ]),
    );

    renderRail();
    await screen.findByText("No Art");

    expect(screen.getByTestId("programme-artwork-fallback")).toBeTruthy();
  });
});
