import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockWindow = jest.fn();

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import { type ErrorActionVerb, ErrorFullScreen } from "@/infra/error";

function renderFullScreen(
  code: string,
  supportedActions?: ErrorActionVerb[],
  actionLabels?: Partial<Record<ErrorActionVerb, string>>,
) {
  const onAction = jest.fn();
  const view = render(
    <ErrorFullScreen
      code={code}
      actionLabels={actionLabels}
      onAction={onAction}
      supportedActions={supportedActions}
    />,
  );

  return { ...view, onAction };
}

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, number>;
}

describe("<ErrorFullScreen />", () => {
  test("shows the copy, the code and the action on a phone", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId, getByText } = renderFullScreen("NET_001");

    getByText("No internet connection");
    getByText(
      "We can't connect right now. Please check your network connection and try again.",
    );
    getByText("NET_001");
    getByTestId("error-action-acknowledge");
    getByTestId("screen-background-artwork");
  });

  test("uses the phone title and message sizes", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId } = renderFullScreen("NET_001");

    expect(
      flatten(getByTestId("error-full-screen-code").props.style).fontSize,
    ).toBe(18);
  });

  test("narrows the button on a tablet in portrait", () => {
    mockWindow.mockReturnValue({ height: 1194, width: 834 });

    const { getByTestId } = renderFullScreen("NET_001");

    expect(
      flatten(getByTestId("error-action-acknowledge").props.style).maxWidth,
    ).toBe(174);
  });

  test("widens the button on a tablet in landscape", () => {
    mockWindow.mockReturnValue({ height: 834, width: 1194 });

    const { getByTestId } = renderFullScreen("NET_001");

    expect(
      flatten(getByTestId("error-action-acknowledge").props.style).maxWidth,
    ).toBe(263);
  });

  test("draws the action as the design's yellow pill with dark text", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId, getByText } = renderFullScreen("NET_001");

    expect(getByText("Okay").props.className).toContain("text-dark-slate-blue");
    expect(getByTestId("error-action-acknowledge").props.className).toContain(
      "bg-golden-yellow",
    );
    expect(
      flatten(getByTestId("error-action-acknowledge").props.style).height,
    ).toBe(45);
  });

  test("insets the column as the designs do on each shape", () => {
    const sideInsetAt = (width: number, height: number) => {
      mockWindow.mockReturnValue({ height, width });
      const { getByTestId, unmount } = renderFullScreen("NET_001");
      const inset = flatten(
        getByTestId("error-full-screen-scroll").props.contentContainerStyle,
      ).paddingHorizontal;
      unmount();

      return inset;
    };

    expect(sideInsetAt(375, 812)).toBe(16);
    expect(sideInsetAt(834, 1194)).toBe(42);
    expect(sideInsetAt(1194, 834)).toBe(248);
  });

  test("keeps a way out when the supported actions leave none", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId } = renderFullScreen("NET_003", ["retry"]);

    getByTestId("error-action-retry");
    getByTestId("error-action-back");
  });

  test("reports the action verb", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByTestId, onAction } = renderFullScreen("NET_001");

    fireEvent.press(getByTestId("error-action-acknowledge"));

    expect(onAction).toHaveBeenCalledWith("acknowledge");
  });

  test("allows a page to clarify a standard action label", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByText } = renderFullScreen("SYS_002", undefined, {
      refresh: "Retry",
    });

    getByText("Retry");
  });
});

describe("<ErrorFullScreen /> message spacing", () => {
  test("drops the title offset when the entry has no title", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByText } = renderFullScreen("AUTH_002");

    expect(
      flatten(getByText("Incorrect username or password").props.style)
        .marginTop,
    ).toBe(0);
  });

  test("keeps the title offset when the entry has one", () => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });

    const { getByText } = renderFullScreen("NET_001");

    expect(
      flatten(
        getByText(
          "We can't connect right now. Please check your network connection and try again.",
        ).props.style,
      ).marginTop,
    ).toBe(12);
  });
});
