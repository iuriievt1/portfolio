import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

const mockGetAllChannels = jest.fn();
const mockGetProgrammeGuide = jest.fn();
const mockGetChannelNowAndNextSchedule = jest.fn();
const mockCreatePlaySession = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getAllChannels: mockGetAllChannels,
    getChannelNowAndNextSchedule: mockGetChannelNowAndNextSchedule,
    getProgrammeGuide: mockGetProgrammeGuide,
  },
  PlaySession: {
    createPlaySession: mockCreatePlaySession,
  },
}));

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

const {
  useLiveChannels,
} = require("@/features/live-channels/hooks/use-live-channels");

function buildWrapper() {
  const queryClient = new QueryClient({
    // gcTime 0 so the client keeps no collection timer alive after the test.
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useLiveChannels caching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllChannels.mockResolvedValue([
      { id: "bfbs-channel-1", isPlayable: true, name: "WDR" },
    ]);
    mockGetProgrammeGuide.mockResolvedValue({
      channels: [{ channelId: "bfbs-channel-1", programmes: [] }],
    });
    mockCreatePlaySession.mockResolvedValue({
      close: jest.fn(),
      id: "session-1",
    });
  });

  test("does not refetch when a second screen subscribes", async () => {
    const wrapper = buildWrapper();

    const home = renderHook(() => useLiveChannels(), { wrapper });
    await waitFor(() => {
      expect(home.result.current.channels).toHaveLength(1);
    });
    expect(mockGetAllChannels).toHaveBeenCalledTimes(1);

    const player = renderHook(() => useLiveChannels(), { wrapper });
    await waitFor(() => {
      expect(player.result.current.channels).toHaveLength(1);
    });

    expect(mockGetAllChannels).toHaveBeenCalledTimes(1);
  });
});
