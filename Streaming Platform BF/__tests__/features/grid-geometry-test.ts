import { renderHook } from "@testing-library/react-native";

const mockWindow = jest.fn();

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

const {
  useGridGeometry,
} = require("@/features/content-rails/components/content-grid/use-content-grid");

describe("useGridGeometry", () => {
  test("lays a phone out exactly as the design measures it", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { result } = renderHook(() => useGridGeometry());

    expect(result.current.columns).toBe(2);
    expect(result.current.tileWidth).toBe(168);
    expect(result.current.gridPadding).toBe(15);
    expect(result.current.columnGap).toBe(8);
    expect(result.current.rowGap).toBe(20);
  });

  test("lays a portrait tablet out exactly as the design measures it", () => {
    mockWindow.mockReturnValue({ height: 1180, width: 820 });

    const { result } = renderHook(() => useGridGeometry());

    expect(result.current.columns).toBe(4);
    expect(result.current.tileWidth).toBe(173);
    expect(result.current.gridPadding).toBe(40);
    expect(result.current.columnGap).toBe(16);
    expect(result.current.rowGap).toBe(20);
  });

  test("lays a landscape tablet out exactly as the design measures it", () => {
    mockWindow.mockReturnValue({ height: 820, width: 1180 });

    const { result } = renderHook(() => useGridGeometry());

    expect(result.current.columns).toBe(4);
    expect(result.current.tileWidth).toBe(263);
    expect(result.current.gridPadding).toBe(40);
    expect(result.current.columnGap).toBe(16);
    expect(result.current.rowGap).toBe(20);
  });

  test("scales the header for the form factor it is on", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });
    const phone = renderHook(() => useGridGeometry()).result.current.header;

    mockWindow.mockReturnValue({ height: 1180, width: 820 });
    const tablet = renderHook(() => useGridGeometry()).result.current.header;

    expect(phone).toMatchObject({
      backLabelSize: 14,
      backMarginTop: 16,
      titleBlockMarginTop: 32,
      titleSize: 36,
    });
    expect(tablet).toMatchObject({
      backLabelSize: 16,
      backMarginTop: 23,
      titleBlockMarginTop: 56,
      titleSize: 38,
    });
    expect(tablet.height).toBe(23 + 20 + 56 + 80 + 24);

    mockWindow.mockReturnValue({ height: 820, width: 1180 });
    const landscape = renderHook(() => useGridGeometry()).result.current.header;

    expect(landscape).toEqual(tablet);
  });

  test("keeps two columns on the narrowest phone", () => {
    mockWindow.mockReturnValue({ height: 667, width: 320 });

    const { result } = renderHook(() => useGridGeometry());

    expect(result.current.columns).toBe(2);
    expect(result.current.tileWidth).toBe(141);
  });
});
