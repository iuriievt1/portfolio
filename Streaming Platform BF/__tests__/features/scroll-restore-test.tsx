import { renderHook } from "@testing-library/react-native";

import { useScrollRestore } from "@/features/content-rails/hooks/use-scroll-restore";

describe("scroll restore", () => {
  test("keeps the same start across renders, so focus effects run once", () => {
    const { rerender, result } = renderHook(() => useScrollRestore());
    const firstStart = result.current.start;
    const firstCancel = result.current.cancel;

    rerender({});

    expect(result.current.start).toBe(firstStart);
    expect(result.current.cancel).toBe(firstCancel);
  });
});
