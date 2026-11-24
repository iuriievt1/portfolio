const mockReportError = jest.fn();

jest.mock("@/infra/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import { SynamediaGoApiError } from "@bfbs/common-sdk";
import { act, renderHook } from "@testing-library/react-native";

import {
  clearDeviceRemoved,
  useIsDeviceRemoved,
} from "../../device-removed-store";
import { handleDeviceRemoval } from "../device-removal";

function renderIsDeviceRemoved() {
  return renderHook(() => useIsDeviceRemoved());
}

describe("handleDeviceRemoval", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeviceRemoved();
  });

  it("handles an SDK removal error, sets the flag and reports the original error", () => {
    const error = new SynamediaGoApiError({
      code: "AUTH_020",
      reason: "device_not_registered",
      status: 403,
      statusText: "Forbidden",
    });
    const { result } = renderIsDeviceRemoved();

    let isHandled = false;
    act(() => {
      isHandled = handleDeviceRemoval(error);
    });

    expect(isHandled).toBe(true);
    expect(result.current).toBe(true);
    expect(mockReportError).toHaveBeenCalledWith(error, {
      tags: { area: "auth", operation: "device_removed" },
    });
  });

  it("reports once when several requests fail for the same removal", () => {
    const createError = () =>
      new SynamediaGoApiError({
        code: "AUTH_020",
        reason: "device_not_registered",
        status: 403,
        statusText: "Forbidden",
      });

    act(() => {
      expect(handleDeviceRemoval(createError())).toBe(true);
      expect(handleDeviceRemoval(createError())).toBe(true);
      expect(handleDeviceRemoval(createError())).toBe(true);
    });

    expect(mockReportError).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "an expired session",
      new SynamediaGoApiError({
        code: "AUTH_006",
        status: 401,
        statusText: "Unauthorized",
      }),
    ],
    [
      "a 403 without the removal reason",
      new SynamediaGoApiError({ status: 403, statusText: "Forbidden" }),
    ],
    ["a plain error", new Error("network down")],
  ])("ignores %s", (_label, error) => {
    const { result } = renderIsDeviceRemoved();

    let isHandled = true;
    act(() => {
      isHandled = handleDeviceRemoval(error);
    });

    expect(isHandled).toBe(false);
    expect(result.current).toBe(false);
    expect(mockReportError).not.toHaveBeenCalled();
  });
});
