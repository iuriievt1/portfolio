import { renderHook } from "@testing-library/react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useRailScrollMemory } from "@/features/content-rails/hooks/use-rail-scroll-memory";

function scrollEvent(x: number) {
  return {
    nativeEvent: { contentOffset: { x, y: 0 } },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

describe("useRailScrollMemory", () => {
  it("starts at offset 0 for a rail it has not seen", () => {
    const { result } = renderHook(() => useRailScrollMemory("rail-unseen"));

    expect(result.current.initialOffset).toBe(0);
    expect(result.current.hasSavedOffset).toBe(false);
  });

  it("restores the last saved offset when the rail is remounted", () => {
    const first = renderHook(() => useRailScrollMemory("rail-a"));

    first.result.current.saveOffset(scrollEvent(240));
    first.unmount();

    const second = renderHook(() => useRailScrollMemory("rail-a"));

    expect(second.result.current.initialOffset).toBe(240);
    expect(second.result.current.hasSavedOffset).toBe(true);
  });

  it("keeps each rail's offset independent", () => {
    renderHook(() => useRailScrollMemory("rail-b")).result.current.saveOffset(
      scrollEvent(100),
    );

    const other = renderHook(() => useRailScrollMemory("rail-c"));

    expect(other.result.current.initialOffset).toBe(0);
  });

  it("freezes initialOffset at mount, unaffected by later scrolling", () => {
    const { result } = renderHook(() => useRailScrollMemory("rail-d"));

    result.current.saveOffset(scrollEvent(300));

    expect(result.current.initialOffset).toBe(0);
  });
});
