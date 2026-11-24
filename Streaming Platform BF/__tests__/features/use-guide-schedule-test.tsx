import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

jest.mock("@bfbs/common-sdk", () => ({
  ContentCatalogue: {
    getAllChannels: jest.fn(),
    getProgrammeGuide: jest.fn(),
  },
}));

import { ContentCatalogue } from "@bfbs/common-sdk";
import { useGuideSchedule } from "@/features/full-guide";

const mockGetAllChannels = ContentCatalogue.getAllChannels as jest.Mock;
const mockGetProgrammeGuide = ContentCatalogue.getProgrammeGuide as jest.Mock;

// A fixed week with no clock change, so a 25-hour day can't add a gap.
const OPENED_AT_MS = Date.UTC(2026, 5, 15, 12);

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function renderSchedule(visibleDayIndex: number) {
  return renderHook(
    (props: { visibleDayIndex: number }) =>
      useGuideSchedule({ openedAtMs: OPENED_AT_MS, ...props }),
    { initialProps: { visibleDayIndex }, wrapper },
  );
}

describe("useGuideSchedule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllChannels.mockResolvedValue([
      { id: "one", isPlayable: true, logicalChannelNumber: 1, name: "One" },
      { id: "two", isPlayable: false, logicalChannelNumber: 2, name: "Two" },
    ]);
    mockGetProgrammeGuide.mockResolvedValue({ channels: [] });
  });

  test("asks for one whole day per request, sized to the line-up", async () => {
    const { result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const [input] = mockGetProgrammeGuide.mock.calls[0] ?? [];

    expect(input).toEqual({
      from: new Date(result.current.days[0]?.startMs ?? 0).toISOString(),
      size: 2,
      windowDuration: 24,
    });
    expect(input.programmeLimit).toBeUndefined();
  });

  test("keeps the same channels while only the visible day moves", async () => {
    const { rerender, result } = renderSchedule(0);

    await waitFor(() => {
      expect(mockGetProgrammeGuide).toHaveBeenCalledTimes(7);
      expect(result.current.isLoading).toBe(false);
    });
    await waitFor(() => {
      expect(result.current.channels[0]?.cells.length).toBeGreaterThan(0);
    });

    const before = result.current.channels;
    rerender({ visibleDayIndex: 1 });
    rerender({ visibleDayIndex: 2 });

    expect(result.current.channels).toBe(before);
  });

  test("starts loading all seven days immediately", async () => {
    const { result } = renderSchedule(3);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetProgrammeGuide).toHaveBeenCalledTimes(7);
  });

  test("covers a week", async () => {
    const { result } = renderSchedule(2);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.days).toHaveLength(7);
  });

  test("joins the loaded days into one row per channel", async () => {
    mockGetProgrammeGuide.mockImplementation(({ from }: { from: string }) => {
      const startMs = new Date(from).getTime() + 3_600_000;

      return Promise.resolve({
        channels: [
          {
            channelId: "one",
            programmes: [
              {
                expirationDateTime: new Date(startMs + 3_600_000).toISOString(),
                id: `programme-${from}`,
                startDateTime: new Date(startMs).toISOString(),
                title: "Programme",
              },
            ],
          },
        ],
      });
    });

    const { result } = renderSchedule(3);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const cells = result.current.channels[0]?.cells ?? [];

    expect(result.current.channels).toHaveLength(1);
    expect(
      cells.filter((cell) => cell.programme.title === "Programme"),
    ).toHaveLength(7);
  });

  test("labels the holes the loaded days leave between programmes", async () => {
    mockGetProgrammeGuide.mockImplementation(({ from }: { from: string }) => {
      const startMs = new Date(from).getTime() + 3_600_000;

      return Promise.resolve({
        channels: [
          {
            channelId: "one",
            programmes: [
              {
                expirationDateTime: new Date(startMs + 3_600_000).toISOString(),
                id: `programme-${from}`,
                startDateTime: new Date(startMs).toISOString(),
                title: "Programme",
              },
            ],
          },
        ],
      });
    });

    const { result } = renderSchedule(3);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const cells = result.current.channels[0]?.cells ?? [];
    const dayStartMs = result.current.days[0]?.startMs ?? 0;

    expect(
      cells.filter(
        (cell) => cell.programme.title === "Programme Info Not Available",
      ),
    ).toHaveLength(8);
    expect(cells[0]).toMatchObject({
      endMs: dayStartMs + 3_600_000,
      startMs: dayStartMs,
    });
  });

  test("keeps a day that is still loading blank", async () => {
    mockGetProgrammeGuide
      .mockResolvedValueOnce({ channels: [] })
      .mockReturnValue(new Promise(() => {}));

    const { result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.channels[0]?.cells).toHaveLength(1);
    });

    const [today] = result.current.days;

    expect(result.current.channels[0]?.cells[0]).toMatchObject({
      endMs: today?.endMs,
      startMs: today?.startMs,
    });
  });

  test("drops the channels the line-up marks unplayable", async () => {
    const { result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.channels).toHaveLength(1);
    });

    expect(result.current.channels[0]?.id).toBe("one");
  });

  test("keeps the guide up once a day has shown, while a further day loads", async () => {
    mockGetProgrammeGuide
      .mockResolvedValueOnce({ channels: [] })
      .mockReturnValue(new Promise(() => {}));

    const { rerender, result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    rerender({ visibleDayIndex: 3 });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.channels).toHaveLength(1);
  });

  test("ignores a neighbouring day's failure", async () => {
    mockGetProgrammeGuide
      .mockResolvedValueOnce({ channels: [] })
      .mockRejectedValue(new Error("tomorrow is down"));

    const { result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  test("surfaces a failing day", async () => {
    mockGetProgrammeGuide.mockRejectedValue(new Error("guide is down"));

    const { result } = renderSchedule(0);

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});
