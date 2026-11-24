import { act, render } from "@testing-library/react-native";
import { AccessibilityInfo, Animated } from "react-native";
import { PlayerLoadingOverlay } from "../player-loading-overlay";

describe("PlayerLoadingOverlay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("stays hidden until its delay has elapsed", () => {
    const { getByTestId, queryByTestId } = render(
      <PlayerLoadingOverlay delayMs={3000} />,
    );

    act(() => jest.advanceTimersByTime(2999));
    expect(getByTestId("player-loading-overlay")).toHaveStyle({
      backgroundColor: "#030a0c",
    });
    expect(queryByTestId("player-loading-indicator")).toBeNull();

    act(() => jest.advanceTimersByTime(1));
    expect(getByTestId("player-loading-indicator")).toBeTruthy();
  });

  it("exposes and announces an immediate accessible loading state", () => {
    const { getByLabelText, getByTestId } = render(<PlayerLoadingOverlay />);

    expect(getByTestId("player-loading-overlay")).toBeTruthy();
    expect(getByLabelText("Video loading").props.accessibilityRole).toBe(
      "progressbar",
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      "Video loading",
    );
  });

  it("uses the linear 750ms rotation from Figma", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValueOnce(false);
    const timing = jest.spyOn(Animated, "timing");

    render(<PlayerLoadingOverlay />);
    await act(async () => {});

    expect(timing).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({
        duration: 750,
        easing: expect.any(Function),
        toValue: 1,
        useNativeDriver: true,
      }),
    );
  });
});
