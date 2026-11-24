import {
  ERROR_CATALOGUE,
  ensureExitAction,
  formatErrorCopy,
  getErrorEntry,
} from "@/infra/error";

describe("error catalogue", () => {
  test("carries every code from the Error Table", () => {
    const codes = Object.keys(ERROR_CATALOGUE);

    expect(codes).toHaveLength(38);
    expect(codes).toEqual(
      expect.arrayContaining(["AUTH_019", "AUTH_020", "AUTH_021", "SYS_003"]),
    );
  });

  test("keeps the table copy for a modal row", () => {
    expect(getErrorEntry("PLAY_006")).toEqual({
      actions: [
        { label: "Update App", verb: "updateApp" },
        { label: "Cancel", verb: "cancel" },
      ],
      message: "Your device can't play this video format",
      presentation: "modal",
      title: "Format not supported",
      whatToDo: "Update your app or device software",
    });
  });

  test("keeps the table behaviour where the label hides it", () => {
    expect(getErrorEntry("NET_003").actions).toEqual([
      { label: "Okay", verb: "retry" },
    ]);
    expect(getErrorEntry("PLAY_008").actions).toEqual([
      { label: "Close", verb: "back" },
    ]);
  });

  test("adds a way out to a dialog whose actions all stay put", () => {
    expect(ensureExitAction(getErrorEntry("NET_003").actions)).toEqual([
      { label: "Okay", verb: "retry" },
      { label: "Back", verb: "back" },
    ]);
  });

  test("leaves an entry that already has a way out alone", () => {
    const actions = getErrorEntry("PLAY_001").actions;

    expect(ensureExitAction(actions)).toBe(actions);
  });

  test("keeps a hard block free of actions", () => {
    expect(ensureExitAction(getErrorEntry("AUTH_019").actions)).toEqual([]);
  });

  test("treats Sign In as a way out, so AUTH_020 gets no Back", () => {
    expect(ensureExitAction(getErrorEntry("AUTH_020").actions)).toEqual([
      { label: "Sign In", verb: "signIn" },
    ]);
  });

  test("prints the message and the advice as one sentence", () => {
    expect(formatErrorCopy(getErrorEntry("PLAY_002"))).toBe(
      "Sorry, this title isn't available right now. Browse other titles or check back later.",
    );
  });

  test("prints the message alone when the table has no advice", () => {
    expect(formatErrorCopy(getErrorEntry("AUTH_002"))).toBe(
      "Incorrect username or password",
    );
  });

  test("falls back to the unhandled-exception row for an unknown code", () => {
    expect(getErrorEntry("NOPE_999")).toEqual(ERROR_CATALOGUE.SYS_002);
  });
});
