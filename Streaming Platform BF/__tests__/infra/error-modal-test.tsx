import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

const mockWindow = jest.fn();

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockWindow(),
}));

import { ErrorModal } from "@/infra/error";

function renderModal(code: string) {
  const onAction = jest.fn();
  const view = render(<ErrorModal code={code} onAction={onAction} />);

  return { ...view, onAction };
}

function flatten(style: unknown) {
  return StyleSheet.flatten(style) as Record<string, number>;
}

describe("<ErrorModal /> on a phone", () => {
  beforeEach(() => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });
  });

  test("shows the copy, the code and both actions", () => {
    const { getByTestId, getByText } = renderModal("PLAY_006");

    getByText("Format not supported");
    getByText(
      "Your device can't play this video format. Update your app or device software.",
    );
    getByText("Error code: PLAY_006");
    getByTestId("error-action-updateApp");
    getByTestId("error-action-cancel");
  });

  test("sizes the card to the phone design", () => {
    const { getByTestId } = renderModal("PLAY_006");

    const cardStyle = flatten(getByTestId("error-modal-card").props.style);

    expect(cardStyle.maxWidth).toBe(343);
    expect(cardStyle.paddingBottom).toBe(34);
    expect(cardStyle.borderRadius).toBe(8);
  });

  test("keeps both labels readable on their own pill", () => {
    const { getByText } = renderModal("PLAY_001");

    expect(getByText("Retry").props.className).toContain(
      "text-dark-slate-blue",
    );
    expect(getByText("Back").props.className).toContain("text-white");
  });

  test("reports the action verb rather than the label", () => {
    const { getByTestId, onAction } = renderModal("NET_003");

    fireEvent.press(getByTestId("error-action-retry"));

    expect(onAction).toHaveBeenCalledWith("retry");
  });
});

describe("<ErrorModal /> on a tablet", () => {
  test("uses the wider card in portrait", () => {
    mockWindow.mockReturnValue({ height: 1194, width: 834 });

    const { getByTestId } = renderModal("PLAY_006");

    expect(flatten(getByTestId("error-modal-card").props.style).maxWidth).toBe(
      646,
    );
    expect(flatten(getByTestId("error-modal-code").props.style).fontSize).toBe(
      20,
    );
  });

  test("tightens the action inset in landscape", () => {
    mockWindow.mockReturnValue({ height: 834, width: 1194 });

    const { getByTestId } = renderModal("PLAY_006");

    expect(
      flatten(getByTestId("error-modal-actions").props.style).paddingHorizontal,
    ).toBe(56);
  });
});

describe("<ErrorModal /> for an entry without a title", () => {
  beforeEach(() => {
    mockWindow.mockReturnValue({ height: 812, width: 375 });
  });

  test("drops the title offsets", () => {
    const { getByTestId, getByText } = renderModal("AUTH_002");

    const cardStyle = flatten(getByTestId("error-modal-card").props.style);
    const messageStyle = flatten(
      getByText("Incorrect username or password").props.style,
    );

    expect(cardStyle.paddingTop).toBe(29);
    expect(messageStyle.marginTop).toBe(0);
  });

  test("keeps them for an entry with a title", () => {
    const { getByTestId, getByText } = renderModal("PLAY_006");

    const cardStyle = flatten(getByTestId("error-modal-card").props.style);
    const messageStyle = flatten(
      getByText(
        "Your device can't play this video format. Update your app or device software.",
      ).props.style,
    );

    expect(cardStyle.paddingTop).toBe(28);
    expect(messageStyle.marginTop).toBe(7);
  });
});
