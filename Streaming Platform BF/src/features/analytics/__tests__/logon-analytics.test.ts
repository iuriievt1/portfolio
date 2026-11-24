const mockTrack = jest.fn();

jest.mock("../analytics-manager", () => ({
  analyticsManager: { track: (event: unknown) => mockTrack(event) },
}));

jest.mock("@/infra/error", () => ({
  reportError: jest.fn(),
}));

import { ActionLogonResult, EventType } from "@bfbs/common-sdk";
import { reportError } from "@/infra/error";
import { trackSignIn, trackSignOut } from "../logon-analytics";

describe("logon analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends LOGON_SUCCESS with only the result", () => {
    trackSignIn();

    expect(mockTrack).toHaveBeenCalledWith({
      data: { result: ActionLogonResult.LOGON_SUCCESS },
      type: EventType.ACTION_LOGON,
    });
  });

  it("sends LOGOUT_SUCCESS with only the result", () => {
    trackSignOut();

    expect(mockTrack).toHaveBeenCalledWith({
      data: { result: ActionLogonResult.LOGOUT_SUCCESS },
      type: EventType.ACTION_LOGON,
    });
  });

  it("reports a tracking error instead of throwing it", () => {
    const failure = new Error("event bus failed");
    mockTrack.mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => trackSignIn()).not.toThrow();
    expect(reportError).toHaveBeenCalledWith(failure, {
      tags: { area: "analytics", operation: "track_logon" },
    });
  });
});
