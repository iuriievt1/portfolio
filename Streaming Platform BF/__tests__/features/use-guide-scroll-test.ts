import { renderHook } from "@testing-library/react-native";
import { useGuideScroll } from "@/features/full-guide";

describe("useGuideScroll", () => {
  test("remembers every offset the timeline reports", () => {
    const { result } = renderHook(() => useGuideScroll());

    result.current.follow(500);
    result.current.follow(460);

    expect(result.current.readOffset()).toBe(460);
  });

  test("remembers where a programmatic scroll lands", () => {
    const { result } = renderHook(() => useGuideScroll());
    const scrollTo = jest.fn();
    result.current.scrollRef.current = { scrollTo } as never;

    result.current.scrollTo(300);

    expect(result.current.readOffset()).toBe(300);
    expect(scrollTo).toHaveBeenCalledWith({ animated: false, x: 300 });
  });

  test("hands the resting offset to what pins to the timeline once it stops", () => {
    const { result } = renderHook(() => useGuideScroll());
    const setValue = jest.spyOn(result.current.scrollOffset, "setValue");

    result.current.follow(420);
    result.current.settle(480);

    expect(setValue).toHaveBeenCalledWith(480);
    expect(result.current.readOffset()).toBe(480);
  });

  test("moves what pins to the timeline at once on a jump, but leaves a glide to the native scroll", () => {
    const { result } = renderHook(() => useGuideScroll());
    const setValue = jest.spyOn(result.current.scrollOffset, "setValue");

    result.current.scrollTo(300);
    result.current.scrollTo(600, { animated: true });

    expect(setValue.mock.calls).toEqual([[300]]);
    expect(result.current.readOffset()).toBe(600);
  });
});
