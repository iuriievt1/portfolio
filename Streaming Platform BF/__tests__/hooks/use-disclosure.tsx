import { act, renderHook } from "@testing-library/react-native";

import { useDisclosure } from "@/hooks/use-disclosure";

describe("useDisclosure", () => {
  it("initialises as closed", () => {
    const { result } = renderHook(() => useDisclosure());

    expect(result.current.isOpen).toBe(false);
  });

  it("opens when open() is called", () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("closes when close() is called after opening", () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("calling open() multiple times keeps it open", () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.open();
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("calling close() when already closed keeps it closed", () => {
    const { result } = renderHook(() => useDisclosure());

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it("open and close are stable references across renders", () => {
    const { result, rerender } = renderHook(() => useDisclosure());

    const { open: openBefore, close: closeBefore } = result.current;

    rerender({});

    expect(result.current.open).toBe(openBefore);
    expect(result.current.close).toBe(closeBefore);
  });
});
