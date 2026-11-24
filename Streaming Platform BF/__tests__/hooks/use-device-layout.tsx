import { renderHook } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";

import { useDeviceLayout } from "@/hooks/use-device-layout";

jest.mock("react-native", () => ({
  useWindowDimensions: jest.fn(),
}));

const mockUseWindowDimensions = useWindowDimensions as jest.MockedFunction<
  typeof useWindowDimensions
>;

function mockWindow({ height, width }: { height: number; width: number }) {
  mockUseWindowDimensions.mockReturnValue({
    fontScale: 1,
    height,
    scale: 2,
    width,
  });
}

describe("useDeviceLayout", () => {
  test("reports a portrait phone", () => {
    mockWindow({ height: 844, width: 390 });

    const { result } = renderHook(() => useDeviceLayout());

    expect(result.current).toEqual({
      height: 844,
      isLandscape: false,
      isTablet: false,
      width: 390,
    });
  });

  test("reports a landscape phone as landscape but not a tablet", () => {
    mockWindow({ height: 390, width: 844 });

    const { result } = renderHook(() => useDeviceLayout());

    expect(result.current.isLandscape).toBe(true);
    expect(result.current.isTablet).toBe(false);
  });

  test("reports a tablet in both orientations", () => {
    mockWindow({ height: 1180, width: 820 });

    const { result: portrait } = renderHook(() => useDeviceLayout());

    expect(portrait.current.isLandscape).toBe(false);
    expect(portrait.current.isTablet).toBe(true);

    mockWindow({ height: 820, width: 1180 });

    const { result: landscape } = renderHook(() => useDeviceLayout());

    expect(landscape.current.isLandscape).toBe(true);
    expect(landscape.current.isTablet).toBe(true);
  });
});
