import { act, renderHook } from "@testing-library/react-native";

const mockStart = jest.fn((restore: () => void) => {
  restore();
  return jest.fn();
});
type FocusEffect = () => undefined | (() => void);

let focusEffect: FocusEffect | undefined;

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: FocusEffect) => {
    focusEffect = effect;
  },
}));

jest.mock("@/features/content-rails/hooks/use-scroll-restore", () => ({
  useScrollRestore: () => ({
    cancel: jest.fn(),
    coverOpacity: 0,
    isRestoring: () => false,
    start: mockStart,
  }),
}));

const useRailScrollRestore =
  require("@/features/content-rails/hooks/use-rail-scroll-restore").useRailScrollRestore;

describe("useRailScrollRestore", () => {
  beforeEach(() => {
    focusEffect = undefined;
    mockStart.mockClear();
  });

  test("restores the saved vertical offset after returning from View All", () => {
    const scrollToOffset = jest.fn();
    const { result } = renderHook(() => useRailScrollRestore());
    result.current.listRef.current = { scrollToOffset };

    act(() => {
      result.current.handleScroll({
        nativeEvent: { contentOffset: { x: 0, y: 240 } },
      });
      result.current.markReturningFromViewAll();
      focusEffect?.();
    });

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 240,
    });
  });
});
