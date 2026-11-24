import { act, fireEvent, render } from "@testing-library/react-native";
import { MiniGuidePanel } from "@/features/mini-guide/components/mini-guide-panel/mini-guide-panel";
import type { MiniGuideChannel } from "@/features/mini-guide/types";

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

const NOW_MS = Date.parse("2026-06-08T09:30:00.000Z");

const CHANNELS: MiniGuideChannel[] = [
  {
    id: "itv",
    logoUrl: "itv-logo.png",
    name: "ITV",
    next: {
      endsAt: "2026-06-08T10:30:00.000Z",
      startsAt: "2026-06-08T10:00:00.000Z",
      title: "Emmerdale",
    },
    now: {
      endsAt: "2026-06-08T10:00:00.000Z",
      startsAt: "2026-06-08T09:00:00.000Z",
      title: "The Chase",
    },
  },
  {
    id: "bbc",
    name: "BBC",
    next: null,
    now: null,
  },
];

function renderPanel(
  overrides: Partial<Parameters<typeof MiniGuidePanel>[0]> = {},
) {
  const onSelectChannel = jest.fn();
  const onClose = jest.fn();

  const view = render(
    <MiniGuidePanel
      channels={CHANNELS}
      focusedChannelId="itv"
      nowMs={NOW_MS}
      onClose={onClose}
      onSelectChannel={onSelectChannel}
      timeZone="Europe/London"
      variant="tablet-portrait"
      {...overrides}
    />,
  );

  return { onClose, onSelectChannel, ...view };
}

describe("<MiniGuidePanel />", () => {
  test("renders now/next titles and the column headers", () => {
    const { getByText } = renderPanel();

    getByText("Now");
    getByText("Next");
    getByText("The Chase");
    getByText("Emmerdale");
  });

  test("shows the channel name when the logo is missing", () => {
    const { getByText } = renderPanel();

    getByText("BBC");
  });

  test("shows a fallback when programme metadata is missing", () => {
    const { getAllByText } = renderPanel();

    expect(getAllByText("Programme Info Not Available").length).toBe(3);
  });

  test("shows the fallback image when a focused programme has no imagery", () => {
    const { getByTestId } = renderPanel({
      focusedChannelId: "itv",
      variant: "tablet-landscape",
    });

    getByTestId("mini-guide-programme-image-fallback");
  });

  test("shows the full fallback in a focused cell with no programme metadata", () => {
    const { getByTestId, getAllByText } = renderPanel({
      focusedChannelId: "bbc",
      variant: "tablet-landscape",
    });

    getByTestId("mini-guide-programme-image-fallback");
    expect(getAllByText("Programme Info Not Available").length).toBe(4);
  });

  test("selects a channel when its row is pressed", () => {
    const { getByTestId, onSelectChannel } = renderPanel();

    fireEvent.press(getByTestId("mini-guide-row-bbc"));

    expect(onSelectChannel).toHaveBeenCalledWith("bbc");
  });

  test("does not select the channel when a Next programme is pressed", () => {
    const { getByText, onSelectChannel } = renderPanel();

    fireEvent.press(getByText("Emmerdale"));

    expect(onSelectChannel).not.toHaveBeenCalled();
  });

  test("closes the guide from the header", () => {
    const { getByRole, onClose } = renderPanel();

    fireEvent.press(getByRole("button", { name: "Hide Mini Guide" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("renders the channel logo labelled with the channel name", () => {
    const { getByLabelText } = renderPanel();

    getByLabelText("ITV");
  });

  test("falls back to the channel name when the logo fails to load", () => {
    const { getByLabelText, getByText } = renderPanel();

    act(() => {
      getByLabelText("ITV").props.onError();
    });

    getByText("ITV");
  });

  test("renders a new logo after a previous logo has failed", () => {
    const { getByLabelText, queryByLabelText, rerender } = renderPanel();

    act(() => {
      getByLabelText("ITV").props.onError();
    });

    expect(queryByLabelText("ITV")).toBeNull();

    rerender(
      <MiniGuidePanel
        channels={CHANNELS.map((channel) =>
          channel.id === "itv"
            ? { ...channel, logoUrl: "updated-itv-logo.png" }
            : channel,
        )}
        focusedChannelId="itv"
        nowMs={NOW_MS}
        onClose={jest.fn()}
        onSelectChannel={jest.fn()}
        timeZone="Europe/London"
        variant="tablet-portrait"
      />,
    );

    getByLabelText("ITV");
  });

  test("rotates the focused channel to the top in the mobile loop", () => {
    const { getAllByTestId } = renderPanel({
      focusedChannelId: "bbc",
      variant: "mobile",
    });

    const rows = getAllByTestId(/^mini-guide-row-/);

    expect(rows).toHaveLength(2);
    expect(rows[0].props.testID).toBe("mini-guide-row-bbc");
  });
});
