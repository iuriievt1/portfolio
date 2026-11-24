import { act, renderHook } from "@testing-library/react-native";
import { useCurrentTime } from "@/hooks/use-current-time";

const MINUTE_MS = 60_000;

describe("useCurrentTime", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 8, 20, 30, 20));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("turns over with the minute, then every minute", () => {
    const { result } = renderHook(() => useCurrentTime(true, MINUTE_MS));
    const openedAt = result.current;

    act(() => {
      jest.advanceTimersByTime(39_000);
    });

    expect(result.current).toBe(openedAt);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(new Date(result.current).getSeconds()).toBe(0);
    expect(result.current - openedAt).toBe(40_000);

    act(() => {
      jest.advanceTimersByTime(MINUTE_MS);
    });

    expect(result.current - openedAt).toBe(100_000);
  });

  test("stands still while inactive", () => {
    const { result } = renderHook(() => useCurrentTime(false, MINUTE_MS));
    const openedAt = result.current;

    act(() => {
      jest.advanceTimersByTime(2 * MINUTE_MS);
    });

    expect(result.current).toBe(openedAt);
  });
});
