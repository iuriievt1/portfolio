import { fireEvent, render } from "@testing-library/react-native";

import NotFoundRoute from "@/app/+not-found";

const mockReplace = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
  },
  usePathname: () => "/missing-route",
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

describe("<NotFoundRoute />", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  test("renders the invalid route state and sends the user home", () => {
    const { getByText } = render(<NotFoundRoute />);

    getByText("Something went wrong");

    fireEvent.press(getByText("Back"));

    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
