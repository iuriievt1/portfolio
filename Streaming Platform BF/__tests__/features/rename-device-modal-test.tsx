import { PortalProvider } from "@gorhom/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockUpdateCurrentDeviceSettings = jest.fn();
const mockReportError = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  DeviceManager: {
    updateCurrentDeviceSettings: (settings: unknown) =>
      mockUpdateCurrentDeviceSettings(settings),
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

import { RenameDeviceModal } from "@/features/my-bfbs/components/rename-device-modal";

function renderModal() {
  // gcTime 0 so a finished mutation doesn't keep Jest running.
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0 },
      queries: { gcTime: 0, retry: false },
    },
  });
  const invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  const onClose = jest.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <PortalProvider>
        <RenameDeviceModal currentName="My Phone" onClose={onClose} />
      </PortalProvider>
    </QueryClientProvider>,
  );

  return { invalidateQueries, onClose };
}

describe("RenameDeviceModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("fills in the current name and allows up to 15 characters", () => {
    renderModal();

    const input = screen.getByTestId("rename-device-input");

    expect(input.props.value).toBe("My Phone");
    expect(input.props.maxLength).toBe(15);
  });

  test("can't save an empty name", () => {
    renderModal();

    fireEvent.changeText(screen.getByTestId("rename-device-input"), "   ");

    expect(screen.getByTestId("rename-device-save")).toBeDisabled();

    fireEvent.press(screen.getByTestId("rename-device-save"));

    expect(mockUpdateCurrentDeviceSettings).not.toHaveBeenCalled();
  });

  test("saves the trimmed name, refreshes the list and closes", async () => {
    mockUpdateCurrentDeviceSettings.mockResolvedValue(undefined);
    const { invalidateQueries, onClose } = renderModal();

    fireEvent.changeText(
      screen.getByTestId("rename-device-input"),
      "  Living Room  ",
    );
    fireEvent.press(screen.getByTestId("rename-device-save"));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateCurrentDeviceSettings).toHaveBeenCalledWith({
      displayName: "Living Room",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["devices"] });
  });

  test("sends one request for a double tap on Save", async () => {
    // Held open so both taps land while the first save is still running.
    let finishSave: () => void = () => {};
    mockUpdateCurrentDeviceSettings.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const { onClose } = renderModal();

    fireEvent.press(screen.getByTestId("rename-device-save"));
    fireEvent.press(screen.getByTestId("rename-device-save"));

    await act(async () => {
      finishSave();
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateCurrentDeviceSettings).toHaveBeenCalledTimes(1);
  });

  test("stays open with an error and reports it when saving fails", async () => {
    const error = new Error("Network down");
    mockUpdateCurrentDeviceSettings.mockRejectedValue(error);
    const { onClose } = renderModal();

    fireEvent.press(screen.getByTestId("rename-device-save"));

    expect(await screen.findByTestId("rename-device-error")).toBeTruthy();
    expect(screen.getByTestId("rename-device-modal")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: { area: "my-bfbs", operation: "rename_device" },
    });
  });

  test("Cancel closes without saving", () => {
    const { onClose } = renderModal();

    fireEvent.press(screen.getByTestId("rename-device-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockUpdateCurrentDeviceSettings).not.toHaveBeenCalled();
  });
});
