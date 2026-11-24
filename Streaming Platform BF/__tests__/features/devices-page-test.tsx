import type { RegisteredDevice } from "@bfbs/common-sdk";
import { PortalProvider } from "@gorhom/portal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

const mockGetCurrentDevice = jest.fn();
const mockGetDeviceLimits = jest.fn();
const mockGetDeviceList = jest.fn();
const mockRegisterCurrentDevice = jest.fn();
const mockReportError = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  DeviceManager: {
    getCurrentDevice: () => mockGetCurrentDevice(),
    getDeviceLimits: () => mockGetDeviceLimits(),
    getDeviceList: () => mockGetDeviceList(),
    registerCurrentDevice: () => mockRegisterCurrentDevice(),
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

import { AuthSessionContext } from "@/features/auth/auth-session-context";
import { DevicesPage } from "@/features/my-bfbs/pages/devices-page";
import { TIME_ZONE_PREFERENCE } from "@/features/my-bfbs/time-zone-preference";
import {
  resetTimeZonePreference,
  setTimeZonePreference,
} from "@/features/my-bfbs/time-zone-preference-store";

const currentPhone: RegisteredDevice = {
  displayDeviceType: "Android Mobile",
  id: "current-phone",
  registeredDateTime: "2026-09-29T10:47:36Z",
  settings: { displayName: "My Phone" },
  type: "COMPANION",
};
const oldPhone: RegisteredDevice = {
  displayDeviceType: "iOS Mobile",
  id: "old-phone",
  registeredDateTime: "2026-09-16T08:34:21Z",
  settings: { displayName: "Old iPhone" },
  type: "COMPANION",
};
const tv: RegisteredDevice = {
  displayDeviceType: "Smart TV",
  id: "tv",
  registeredDateTime: "2026-10-08T10:48:16Z",
  settings: { displayName: "Living Room TV" },
  type: "STB",
};
const browser: RegisteredDevice = {
  displayDeviceType: "Generic Browser",
  id: "browser",
  registeredDateTime: "2026-10-08T10:16:04Z",
  settings: { displayName: "Chrome" },
  type: "BROWSER",
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PortalProvider>
        <DevicesPage />
      </PortalProvider>
    </QueryClientProvider>,
  );
}

async function getRowLabels() {
  const rows = await screen.findAllByTestId("device-row");

  return rows.map((row) => row.props.accessibilityLabel);
}

describe("DevicesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // UK time keeps the expected times the same on every machine.
    setTimeZonePreference(TIME_ZONE_PREFERENCE.UK);
    mockGetCurrentDevice.mockResolvedValue(currentPhone);
    mockGetDeviceList.mockResolvedValue([oldPhone, browser, currentPhone, tv]);
  });

  afterAll(() => {
    resetTimeZonePreference();
  });

  test("shows a loading state while devices load", () => {
    mockGetCurrentDevice.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId("device-list-skeleton")).toBeTruthy();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  test("shows this device first, then the others newest first, with browsers", async () => {
    renderPage();

    expect(await getRowLabels()).toEqual([
      "My Phone, Android Mobile, Current Device, First registered 29 September 2026",
      "Living Room TV, Smart TV, First registered 8 October 2026",
      "Chrome, Generic Browser, First registered 8 October 2026",
      "Old iPhone, iOS Mobile, First registered 16 September 2026",
    ]);
    expect(screen.getByText("Other registered devices")).toBeTruthy();
  });

  test("shows the registration date and time on each row", async () => {
    renderPage();

    expect(
      await screen.findByText("First Registered: 29 September 2026"),
    ).toBeTruthy();
    // The TV and the browser were both registered that day.
    expect(
      screen.getAllByText("First Registered: 8 October 2026"),
    ).toHaveLength(2);
  });

  test("shows the device registered at sign-in without registering again", async () => {
    mockGetDeviceList.mockResolvedValue([currentPhone]);

    renderPage();

    expect(await screen.findByText("Current Device")).toBeTruthy();
    expect(screen.queryByText("Other registered devices")).toBeNull();
    expect(mockRegisterCurrentDevice).not.toHaveBeenCalled();
  });

  test("shows an error, reports it, and retries", async () => {
    const error = new Error("Network down");
    let finishRetry: (device: RegisteredDevice) => void = () => {};
    mockGetCurrentDevice.mockRejectedValueOnce(error).mockReturnValueOnce(
      new Promise((resolve) => {
        finishRetry = resolve;
      }),
    );

    renderPage();

    expect(
      await screen.findByText("We couldn't load your devices."),
    ).toBeTruthy();
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: { area: "my-bfbs", operation: "get_devices" },
    });

    fireEvent.press(screen.getByTestId("devices-retry"));

    expect(await screen.findByTestId("device-list-skeleton")).toBeTruthy();
    expect(screen.queryByText("We couldn't load your devices.")).toBeNull();

    await act(async () => {
      finishRetry(currentPhone);
    });

    await waitFor(() => {
      expect(screen.getAllByTestId("device-row")).toHaveLength(4);
    });
  });

  test("lets screen readers rename this device without swiping", async () => {
    renderPage();

    const [currentRow] = await screen.findAllByTestId("device-row");

    fireEvent(currentRow, "accessibilityAction", {
      nativeEvent: { actionName: "rename" },
    });

    expect(await screen.findByTestId("rename-device-modal")).toBeTruthy();
  });

  test("offers Rename and Remove on this device and Remove on the others", async () => {
    renderPage();

    const [currentRow, ...otherRows] =
      await screen.findAllByTestId("device-row");

    expect(currentRow.props.accessibilityActions).toEqual([
      { label: "Rename", name: "rename" },
      { label: "Remove", name: "remove" },
    ]);
    for (const row of otherRows) {
      expect(row.props.accessibilityActions).toEqual([
        { label: "Remove", name: "remove" },
      ]);
    }
  });

  test("hides the swipe-only edit button from screen readers", async () => {
    renderPage();

    await screen.findAllByTestId("device-row");

    expect(
      screen.getByTestId("rename-device-button", {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("rename-device-button", {
        includeHiddenElements: false,
      }),
    ).toBeNull();
  });

  test("in AUTH_021 lists the household's devices without a current device", async () => {
    mockGetDeviceLimits.mockResolvedValue({
      devices: [oldPhone, tv],
      maxDeviceCount: 2,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PortalProvider>
          <AuthSessionContext
            value={{
              checkAuthenticatedDevice: async () => false,
              isTooManyDevices: true,
              signOut: jest.fn(),
            }}
          >
            <DevicesPage />
          </AuthSessionContext>
        </PortalProvider>
      </QueryClientProvider>,
    );

    // Same newest-first order as the normal page, with no current device.
    expect(await getRowLabels()).toEqual([
      "Living Room TV, Smart TV, First registered 8 October 2026",
      "Old iPhone, iOS Mobile, First registered 16 September 2026",
    ]);
    expect(mockGetCurrentDevice).not.toHaveBeenCalled();
  });
});
