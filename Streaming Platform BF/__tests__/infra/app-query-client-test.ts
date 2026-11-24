const mockRequestSignIn = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  ...require("../../__mocks__/common-sdk-enums"),
}));

jest.mock("@/features/auth/sign-in-request-store", () => ({
  requestSignIn: () => mockRequestSignIn(),
}));

jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

import { SynamediaGoApiError } from "@bfbs/common-sdk";
import { MutationObserver } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import {
  clearDeviceRemoved,
  useIsDeviceRemoved,
} from "@/features/auth/device-removed-store";
import { appQueryClient } from "@/infra/query/app-query-client";

function apiError(code: string, status = 401) {
  return new SynamediaGoApiError({
    code,
    status,
    statusText: status === 401 ? "Unauthorized" : "Forbidden",
  });
}

function removalError() {
  return new SynamediaGoApiError({
    code: "AUTH_020",
    reason: "device_not_registered",
    status: 403,
    statusText: "Forbidden",
  });
}

describe("appQueryClient session expiry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appQueryClient.clear();
  });

  afterEach(() => {
    appQueryClient.clear();
  });

  test.each([
    "AUTH_006",
    "AUTH_007",
  ])("returns to sign-in when SDK refresh reaches terminal %s", async (errorCode) => {
    const error = apiError(errorCode);

    await expect(
      appQueryClient.fetchQuery({
        queryFn: () => Promise.reject(error),
        queryKey: ["expired-session", errorCode],
      }),
    ).rejects.toBe(error);

    expect(mockRequestSignIn).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a temporary network failure", new TypeError("Network request failed")],
    ["a forbidden response", apiError("NOT_ENTITLED", 403)],
    ["a non-terminal auth response", apiError("AUTH_005")],
  ])("preserves the session for %s", async (_name, error) => {
    await expect(
      appQueryClient.fetchQuery({
        queryFn: () => Promise.reject(error),
        queryKey: ["preserved-session", _name],
      }),
    ).rejects.toBe(error);

    expect(mockRequestSignIn).not.toHaveBeenCalled();
  });
});

describe("appQueryClient device removal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDeviceRemoved();
    appQueryClient.clear();
  });

  afterEach(() => {
    appQueryClient.clear();
  });

  test("starts the AUTH_020 flow, not sign-in, when a query finds the device removed", async () => {
    const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());

    await act(async () => {
      await appQueryClient
        .fetchQuery({
          queryFn: () => Promise.reject(removalError()),
          queryKey: ["removed-device"],
        })
        .catch(() => {});
    });

    expect(isDeviceRemoved.result.current).toBe(true);
    expect(mockRequestSignIn).not.toHaveBeenCalled();
  });

  test("leaves a background refetch of data on screen alone", async () => {
    const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());
    appQueryClient.setQueryData(["guide"], { channels: [] });

    await act(async () => {
      await appQueryClient
        .fetchQuery({
          queryFn: () => Promise.reject(removalError()),
          queryKey: ["guide"],
          staleTime: 0,
        })
        .catch(() => {});
    });

    expect(isDeviceRemoved.result.current).toBe(false);
    expect(mockRequestSignIn).not.toHaveBeenCalled();
  });

  test.each([
    ["a removed device", removalError(), true],
    ["another failure", new Error("server down"), false],
  ])("checks a failed mutation for %s", async (_name, error, isRemoved) => {
    const isDeviceRemoved = renderHook(() => useIsDeviceRemoved());
    const observer = new MutationObserver(appQueryClient, {
      mutationFn: () => Promise.reject(error),
    });

    await act(async () => {
      await observer.mutate().catch(() => {});
    });

    expect(isDeviceRemoved.result.current).toBe(isRemoved);
    expect(mockRequestSignIn).not.toHaveBeenCalled();
  });
});
