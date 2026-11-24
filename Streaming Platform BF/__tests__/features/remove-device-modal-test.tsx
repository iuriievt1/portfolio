import type { RegisteredDevice } from "@bfbs/common-sdk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
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

import type { Devices } from "@/features/devices/use-devices";
import { RemoveDeviceModal } from "@/features/my-bfbs/components/remove-device-modal";

const currentPhone: RegisteredDevice = { id: "current-phone" };
const tv: RegisteredDevice = { id: "tv" };
const browser: RegisteredDevice = { id: "browser" };

const initialMetrics = {
  frame: { height: 844, width: 390, x: 0, y: 0 },
  insets: { bottom: 34, left: 0, right: 0, top: 47 },
};

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // gcTime 0 so a finished mutation doesn't keep Jest running.
      mutations: { gcTime: 0 },
      // Keeps the seeded device list, which has no screen watching it.
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
    },
  });
  queryClient.setQueryData<Devices>(["devices"], {
    current: currentPhone,
    others: [tv, browser],
  });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const onClose = jest.fn();
  const onRemoved = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <QueryClientProvider client={queryClient}>
        <RemoveDeviceModal
          deviceId="tv"
          onClose={onClose}
          onRemoved={onRemoved}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );

  return { invalidateQueries, onClose, onRemoved, queryClient };
}

describe("RemoveDeviceModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("asks before removing, with Yes and Cancel", () => {
    renderModal();

    expect(
      screen.getByText("Are you sure you want to remove this device?"),
    ).toBeTruthy();
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  test("Cancel closes without removing", () => {
    const { onClose } = renderModal();

    fireEvent.press(screen.getByTestId("remove-device-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRemoveDevice).not.toHaveBeenCalled();
  });

  test("Yes removes the device, takes it off the list, refreshes and closes", async () => {
    mockRemoveDevice.mockResolvedValue(undefined);
    const { invalidateQueries, onClose, onRemoved, queryClient } =
      renderModal();

    fireEvent.press(screen.getByTestId("remove-device-confirm"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    // AUTH_021 uses this to register the device.
    expect(onRemoved).toHaveBeenCalledTimes(1);
    expect(mockRemoveDevice).toHaveBeenCalledWith("tv");
    expect(queryClient.getQueryData<Devices>(["devices"])?.others).toEqual([
      browser,
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["devices"] });
  });

  test("sends one request for a double tap on Yes", async () => {
    // Held open so both taps land while the first request is still running.
    let finishRemove: () => void = () => {};
    mockRemoveDevice.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRemove = resolve;
      }),
    );
    const { onClose } = renderModal();

    fireEvent.press(screen.getByTestId("remove-device-confirm"));
    fireEvent.press(screen.getByTestId("remove-device-confirm"));

    await act(async () => {
      finishRemove();
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(mockRemoveDevice).toHaveBeenCalledTimes(1);
  });

  test("stays open with an error when removing fails, and can try again", async () => {
    const error = new Error("Network down");
    mockRemoveDevice
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);
    const { onClose, queryClient } = renderModal();

    fireEvent.press(screen.getByTestId("remove-device-confirm"));

    expect(await screen.findByTestId("remove-device-error")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(queryClient.getQueryData<Devices>(["devices"])?.others).toEqual([
      tv,
      browser,
    ]);
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: { area: "my-bfbs", operation: "remove_device" },
    });

    fireEvent.press(screen.getByTestId("remove-device-confirm"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(mockRemoveDevice).toHaveBeenCalledTimes(2);
  });
});
