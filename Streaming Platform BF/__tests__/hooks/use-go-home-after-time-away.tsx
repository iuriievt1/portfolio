import { renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useGoHomeAfterTimeAway } from "@/hooks/use-go-home-after-time-away";

const MINUTE_MS = 60_000;

const mockRouter = {
  canDismiss: jest.fn(),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

const remove = jest.fn();
let sendAppState: (state: AppStateStatus) => void;

// Leaves the app, waits, then comes back.
function returnAfter(ms: number) {
  sendAppState("background");
  jest.advanceTimersByTime(ms);
  sendAppState("active");
}

describe("useGoHomeAfterTimeAway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRouter.canDismiss.mockReturnValue(false);
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        sendAppState = listener;
        return { remove };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("stays on the same page when back before 30 minutes", () => {
    renderHook(() => useGoHomeAfterTimeAway());

    returnAfter(29 * MINUTE_MS);

    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  test("goes Home when back after 30 minutes", () => {
    renderHook(() => useGoHomeAfterTimeAway());

    returnAfter(30 * MINUTE_MS);

    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/");
  });

  test("closes the player or TV guide when one is open", () => {
    mockRouter.canDismiss.mockReturnValue(true);
    renderHook(() => useGoHomeAfterTimeAway());

    returnAfter(30 * MINUTE_MS);

    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/");
  });

  test("skips closing when nothing can be dismissed", () => {
    renderHook(() => useGoHomeAfterTimeAway());

    returnAfter(30 * MINUTE_MS);

    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/");
  });

  test("does nothing when active comes without an earlier background", () => {
    renderHook(() => useGoHomeAfterTimeAway());

    jest.advanceTimersByTime(30 * MINUTE_MS);
    sendAppState("active");

    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  test("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useGoHomeAfterTimeAway());

    unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
