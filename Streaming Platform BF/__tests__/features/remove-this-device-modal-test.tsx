import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

const mockRemoveDevice = jest.fn();
const mockReportError = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  DeviceManager: {
    removeDevice: (deviceId: string) => mockRemoveDevice(deviceId),
  },
}));

jest.mock("@/infra/error", () => ({
  ...jest.requireActual("@/infra/error"),
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@/hooks/use-device-layout", () => ({
  useDeviceLayout: () => ({
    height: 844,
    isLandscape: false,
    isTablet: false,
    width: 390,
  }),
}));

import {
  clearDeviceRemoved,
  useIsDeviceRemoved,
} from "@/features/auth/device-removed-store";
import { RemoveThisDeviceModal } from "@/features/my-bfbs/components/remove-this-device-modal";

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

function renderModal() {
  const onClose = jest.fn();
  const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());

  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <RemoveThisDeviceModal deviceId="this-phone" onClose={onClose} />
    </SafeAreaProvider>,
  );

  return { isDeviceRemoved, onClose };
}

function pressYes() {
  fireEvent.press(screen.getByTestId("remove-this-device-confirm"));
}

describe("RemoveThisDeviceModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeviceRemoved();
    mockRemoveDevice.mockResolvedValue(undefined);
  });

  test("asks before removing, with Yes and Cancel", () => {
    renderModal();

    expect(
      screen.getByText("Are you sure you want to remove this device?"),
    ).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  test("Cancel closes without removing or starting the AUTH_020 flow", () => {
    const { isDeviceRemoved, onClose } = renderModal();

    fireEvent.press(screen.getByTestId("remove-this-device-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRemoveDevice).not.toHaveBeenCalled();
    expect(isDeviceRemoved.result.current).toBe(false);
  });

  test("Yes removes this device first, then starts the AUTH_020 flow", async () => {
    // Held open to check nothing starts before the removal succeeds.
    let finishRemove: () => void = () => {};
    mockRemoveDevice.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRemove = resolve;
      }),
    );
    const { isDeviceRemoved } = renderModal();

    pressYes();

    expect(mockRemoveDevice).toHaveBeenCalledWith("this-phone");
    expect(isDeviceRemoved.result.current).toBe(false);

    await act(async () => {
      finishRemove();
    });

    expect(isDeviceRemoved.result.current).toBe(true);
  });

  test("stays signed in with an error when removing fails, and Cancel still works", async () => {
    const error = new Error("Network down");
    mockRemoveDevice.mockRejectedValue(error);
    const { isDeviceRemoved, onClose } = renderModal();

    pressYes();

    expect(await screen.findByTestId("remove-this-device-error")).toBeTruthy();
    expect(isDeviceRemoved.result.current).toBe(false);
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: { area: "my-bfbs", operation: "remove_current_device" },
    });

    fireEvent.press(screen.getByTestId("remove-this-device-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("a retry after a failed removal tries the removal again", async () => {
    mockRemoveDevice
      .mockRejectedValueOnce(new Error("Network down"))
      .mockResolvedValueOnce(undefined);
    const { isDeviceRemoved } = renderModal();

    pressYes();
    expect(await screen.findByTestId("remove-this-device-error")).toBeTruthy();

    pressYes();

    await waitFor(() => {
      expect(isDeviceRemoved.result.current).toBe(true);
    });
    expect(mockRemoveDevice).toHaveBeenCalledTimes(2);
  });

  test("sends one request for a double tap on Yes", async () => {
    // Held open so both taps land while the first request is still running.
    let finishRemove: () => void = () => {};
    mockRemoveDevice.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRemove = resolve;
      }),
    );
    const { isDeviceRemoved } = renderModal();

    pressYes();
    pressYes();

    await act(async () => {
      finishRemove();
    });

    expect(isDeviceRemoved.result.current).toBe(true);
    expect(mockRemoveDevice).toHaveBeenCalledTimes(1);
  });
});
