import { fireEvent, render } from "@testing-library/react-native";
import { TimeZoneSelector } from "@/features/my-bfbs/components/time-zone-selector";
import { TimeZonePage } from "@/features/my-bfbs/pages/time-zone-page";
import { TIME_ZONE_PREFERENCE } from "@/features/my-bfbs/time-zone-preference";
import {
  resetTimeZonePreference,
  setTimeZonePreference,
} from "@/features/my-bfbs/time-zone-preference-store";

const NOW_MS = Date.parse("2026-07-20T12:34:00.000Z");

describe("TimeZoneSelector", () => {
  beforeEach(() => {
    resetTimeZonePreference();
  });

  test("shows Device Time selected by default", () => {
    const { getByTestId, getByText } = render(
      <TimeZoneSelector isTablet={false} nowMs={NOW_MS} />,
    );

    expect(getByText(/Device Time - /)).toBeTruthy();
    expect(getByTestId("time-zone-option-device")).toHaveProp(
      "accessibilityRole",
      "radio",
    );
    expect(getByTestId("time-zone-option-device")).toHaveProp(
      "accessibilityState",
      { selected: true },
    );
    expect(getByTestId("time-zone-option-uk")).toHaveProp(
      "accessibilityState",
      { selected: false },
    );
  });

  test("shows the design copy without a duplicate page title", () => {
    const { getByText, queryByText } = render(<TimeZonePage />);

    getByText(
      "Set your time zone so Live events and schedules show your preferred time.",
    );
    expect(queryByText("Timezone")).toBeNull();
  });

  test("shows and changes a previously selected value", () => {
    setTimeZonePreference(TIME_ZONE_PREFERENCE.UK);
    const { getByTestId } = render(
      <TimeZoneSelector isTablet nowMs={NOW_MS} />,
    );

    expect(getByTestId("time-zone-option-uk")).toHaveProp(
      "accessibilityState",
      { selected: true },
    );

    fireEvent.press(getByTestId("time-zone-option-device"));

    expect(getByTestId("time-zone-option-device")).toHaveProp(
      "accessibilityState",
      { selected: true },
    );
  });

  test("exposes and toggles the expanded state", () => {
    const { getByTestId, queryByTestId } = render(
      <TimeZoneSelector isTablet={false} nowMs={NOW_MS} />,
    );
    const toggle = getByTestId("time-zone-selector-toggle");

    expect(toggle).toHaveProp("accessibilityState", { expanded: true });
    fireEvent.press(toggle);

    expect(toggle).toHaveProp("accessibilityState", { expanded: false });
    expect(queryByTestId("time-zone-selector-options")).toBeNull();
  });
});
