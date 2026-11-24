import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import { reportError } from "@/infra/error";
import { useAppContentRefresh } from "../use-app-content-refresh";

const STALE_TIME_MS = 5 * 60 * 1000;
const mockQueryFn = jest.fn<Promise<string>, []>();
let mockFocusedEffect: (() => undefined | (() => void)) | undefined;

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (effect: () => undefined | (() => void)) => {
      mockFocusedEffect = effect;
      useEffect(effect, [effect]);
    },
  };
});

jest.mock("@/features/content-rails/app-content", () => ({
  appContentQueryOptions: {
    queryFn: () => mockQueryFn(),
    queryKey: ["appContent"],
    staleTime: 5 * 60 * 1000,
  },
}));

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
}

describe("useAppContentRefresh", () => {
  beforeEach(() => {
    mockQueryFn.mockReset();
    mockFocusedEffect = undefined;
    jest.mocked(reportError).mockReset();
  });

  it("uses fresh catalogue data without making another request", async () => {
    const queryClient = createQueryClient();
    mockQueryFn.mockResolvedValue("fresh catalogue");
    await queryClient.fetchQuery({
      queryFn: () => mockQueryFn(),
      queryKey: ["appContent"],
      staleTime: STALE_TIME_MS,
    });

    renderHook(() => useAppContentRefresh("/"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1));
  });

  it("refreshes stale catalogue data when the page gains focus", async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(["appContent"], "stale catalogue", {
      updatedAt: Date.now() - STALE_TIME_MS - 1,
    });
    mockQueryFn.mockResolvedValue("updated catalogue");

    renderHook(() => useAppContentRefresh("/"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
      expect(queryClient.getQueryData(["appContent"])).toBe(
        "updated catalogue",
      );
    });
  });

  it("checks the query again when a retained dynamic section changes", async () => {
    const queryClient = createQueryClient();
    mockQueryFn.mockResolvedValue("catalogue");
    const { rerender } = renderHook(
      ({ route }: { route: `/${string}` }) => useAppContentRefresh(route),
      {
        initialProps: { route: "/news" },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1));
    queryClient.setQueryData(["appContent"], "stale catalogue", {
      updatedAt: Date.now() - STALE_TIME_MS - 1,
    });
    rerender({ route: "/sport" });

    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(2));
  });

  it("refreshes a stale retained tab when it regains focus", async () => {
    const queryClient = createQueryClient();
    mockQueryFn.mockResolvedValue("catalogue");
    renderHook(() => useAppContentRefresh("/"), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1));
    queryClient.setQueryData(["appContent"], "stale catalogue", {
      updatedAt: Date.now() - STALE_TIME_MS - 1,
    });

    act(() => {
      mockFocusedEffect?.();
    });

    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(2));
  });

  it("deduplicates checks while a shared refresh is running", async () => {
    const queryClient = createQueryClient();
    let resolveRequest: ((value: string) => void) | undefined;
    mockQueryFn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const first = renderHook(() => useAppContentRefresh("/"), {
      wrapper: createWrapper(queryClient),
    });
    const second = renderHook(() => useAppContentRefresh("/on-now"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(mockQueryFn).toHaveBeenCalledTimes(1));
    resolveRequest?.("updated catalogue");
    await waitFor(() =>
      expect(queryClient.getQueryData(["appContent"])).toBe(
        "updated catalogue",
      ),
    );

    first.unmount();
    second.unmount();
  });

  it("keeps cached catalogue data and reports a refresh failure", async () => {
    const queryClient = createQueryClient();
    const error = new Error("refresh failed");
    queryClient.setQueryData(["appContent"], "cached catalogue", {
      updatedAt: Date.now() - STALE_TIME_MS - 1,
    });
    mockQueryFn.mockRejectedValue(error);

    renderHook(() => useAppContentRefresh("/"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(error, {
        tags: {
          area: "content_rails",
          operation: "refresh_app_content_on_navigation",
          route: "/",
        },
      });
    });
    expect(queryClient.getQueryData(["appContent"])).toBe("cached catalogue");
  });
});
