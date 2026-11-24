import { act, renderHook } from "@testing-library/react-native";
import { useMiniGuideAutoDismiss } from "@/features/mini-guide/hooks/use-mini-guide-auto-dismiss";

describe("useMiniGuideAutoDismiss", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("dismisses after 5s without interaction", () => {
    const onDismiss = jest.fn();
    renderHook(() => useMiniGuideAutoDismiss(onDismiss));

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test("resets the countdown on interaction", () => {
    const onDismiss = jest.fn();
    const { result } = renderHook(() => useMiniGuideAutoDismiss(onDismiss));

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    act(() => {
      result.current();
    });

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
