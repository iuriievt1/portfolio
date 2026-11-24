import { fireEvent, render } from "@testing-library/react-native";

const mockOpenURL = jest.fn();
const mockWindow = jest.fn();

jest.mock("expo-linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 47 }),
}));

import { ErrorCopy, ErrorModal, getErrorEntry } from "@/infra/error";

const DEFENCE_GATEWAY_URL = "https://www.defencegateway.mod.uk";

describe("the Defence Gateway link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenURL.mockResolvedValue(true);
    mockWindow.mockReturnValue({ height: 812, width: 375 });
  });

  test("keeps the sentence around the link intact", () => {
    const { getByText } = render(
      <ErrorModal code="AUTH_003" onAction={jest.fn()} />,
    );

    getByText("Your account has expired. Please visit DefenceGateway.mod.uk.");
  });

  test("opens the site from a dialog", () => {
    const { getByTestId } = render(
      <ErrorModal code="AUTH_003" onAction={jest.fn()} />,
    );

    fireEvent.press(getByTestId("error-defence-gateway-link"));

    expect(mockOpenURL).toHaveBeenCalledWith(DEFENCE_GATEWAY_URL);
  });

  test("opens the site from a full screen error", () => {
    const { getByTestId } = render(
      <ErrorCopy
        className="text-center text-oatmeal"
        entry={getErrorEntry("AUTH_003")}
        style={{ fontSize: 14 }}
      />,
    );

    fireEvent.press(getByTestId("error-defence-gateway-link"));

    expect(mockOpenURL).toHaveBeenCalledWith(DEFENCE_GATEWAY_URL);
  });

  test("leaves the rest of the sentence untappable", () => {
    const { getByText } = render(
      <ErrorModal code="AUTH_003" onAction={jest.fn()} />,
    );

    fireEvent.press(
      getByText(
        "Your account has expired. Please visit DefenceGateway.mod.uk.",
      ),
    );

    expect(mockOpenURL).not.toHaveBeenCalled();
  });

  test("prints copy that names no address as plain text", () => {
    const { getByText, queryByTestId } = render(
      <ErrorModal code="AUTH_002" onAction={jest.fn()} />,
    );

    getByText("Incorrect username or password");
    expect(queryByTestId("error-defence-gateway-link")).toBeNull();
  });
});
