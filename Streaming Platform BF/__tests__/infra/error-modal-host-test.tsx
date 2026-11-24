import { PortalProvider } from "@gorhom/portal";
import { fireEvent, render } from "@testing-library/react-native";

const mockDeviceType = jest.fn();
const mockPathname = jest.fn();
const mockWindow = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname(),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

jest.mock("expo-device", () => ({
  DeviceType: { PHONE: "phone", TABLET: "tablet" },
  get deviceType() {
    return mockDeviceType();
  },
}));

import {
  dismissErrorModal,
  ErrorModalHost,
  errorModalStore,
  showErrorModal,
} from "@/infra/error";

function renderHost({ onSignIn = jest.fn() }: { onSignIn?: () => void } = {}) {
  return render(
    <PortalProvider>
      <ErrorModalHost onSignIn={onSignIn} />
    </PortalProvider>,
  );
}

describe("<ErrorModalHost />", () => {
  beforeEach(() => {
    dismissErrorModal();
    mockDeviceType.mockReturnValue("phone");
    mockPathname.mockReturnValue("/");
    mockWindow.mockReturnValue({ height: 812, width: 375 });
  });

  test("runs the call the dialog was raised for and closes", () => {
    const onRetry = jest.fn();

    showErrorModal("NET_003", onRetry);

    const { getByTestId } = renderHost();

    fireEvent.press(getByTestId("error-action-retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("retries the latest call when the same code is raised again", () => {
    const firstRetry = jest.fn();
    const secondRetry = jest.fn();

    showErrorModal("NET_003", firstRetry);
    showErrorModal("NET_003", secondRetry);

    const { getByTestId } = renderHost();

    fireEvent.press(getByTestId("error-action-retry"));

    expect(firstRetry).not.toHaveBeenCalled();
    expect(secondRetry).toHaveBeenCalledTimes(1);
  });

  test("closes a dialog raised without a call to repeat", () => {
    showErrorModal("NET_003");

    const { getByTestId } = renderHost();

    fireEvent.press(getByTestId("error-action-retry"));

    expect(errorModalStore.getState().code).toBeNull();
  });

  test("renders nothing until an error is raised", () => {
    const { queryByTestId } = renderHost();

    expect(queryByTestId("error-modal")).toBeNull();
  });

  test("shows the dialog once the app has settled", () => {
    showErrorModal("PLAY_002");

    const { getByTestId, getByText } = renderHost();

    getByTestId("error-modal");
    getByText("Content Unavailable");
  });

  test("holds the dialog back while a player route is open", () => {
    mockPathname.mockReturnValue("/player/live/bfbs-extra");
    showErrorModal("PLAY_002");

    const { queryByTestId } = renderHost();

    expect(queryByTestId("error-modal")).toBeNull();
  });

  test("shows the dialog on a tablet held in landscape", () => {
    mockDeviceType.mockReturnValue("tablet");
    mockWindow.mockReturnValue({ height: 834, width: 1194 });
    showErrorModal("PLAY_002");

    const { queryByTestId } = renderHost();

    expect(queryByTestId("error-modal")).not.toBeNull();
  });

  test("never blocks the screen with a code the table shows inline", () => {
    showErrorModal("AUTH_002");

    const { queryByTestId } = renderHost();

    expect(queryByTestId("error-modal")).toBeNull();
  });

  test("leaves player errors to the player itself", () => {
    mockPathname.mockReturnValue("/player/vod/frasier");
    showErrorModal("PLAY_001");

    const { queryByTestId } = renderHost();

    expect(queryByTestId("error-modal")).toBeNull();
  });

  test("sends the reader to sign-in and closes the dialog", () => {
    const onSignIn = jest.fn();
    showErrorModal("AUTH_006");

    const { getByTestId } = renderHost({ onSignIn });

    fireEvent.press(getByTestId("error-action-signIn"));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(errorModalStore.getState().code).toBeNull();
  });

  test("dismisses the dialog when the action is acknowledged", () => {
    showErrorModal("PLAY_002");

    const { getByTestId } = renderHost();

    fireEvent.press(getByTestId("error-action-acknowledge"));

    expect(errorModalStore.getState().code).toBeNull();
  });
});
