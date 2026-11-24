jest.mock("@bfbs/common-sdk", () => ({
  SynamediaGoApiError: class MappedApiError extends Error {
    readonly code: string | undefined;
    readonly status: number;

    constructor({ code, status }: { code?: string; status: number }) {
      super(`Synamedia Go request failed: ${code ?? "no code"}`);

      this.code = code;
      this.status = status;
    }
  },
}));

import { SynamediaGoApiError } from "@bfbs/common-sdk";

import {
  getSignInErrorCode,
  getSignInFailureCode,
  SignInError,
} from "@/features/auth/utils/sign-in-error";

function apiError({ code, status = 400 }: { code?: string; status?: number }) {
  return new SynamediaGoApiError({
    ...(code ? { code } : {}),
    status,
    statusText: "Bad Request",
  });
}

describe("getSignInErrorCode", () => {
  test("keeps the code the provider normalised", () => {
    expect(getSignInErrorCode(apiError({ code: "AUTH_002" }))).toBe("AUTH_002");
  });

  test("reads a request that never arrived as a connection failure", () => {
    expect(getSignInErrorCode(new TypeError("Network request failed"))).toBe(
      "NET_001",
    );
  });

  test("falls back to the unexpected code for anything else", () => {
    expect(getSignInErrorCode(new Error("storage is full"))).toBe("SYS_002");
  });

  test("classifies a provider failure that carries no code", () => {
    expect(getSignInErrorCode(apiError({}))).toBe("SYS_002");
  });
});

describe("getSignInFailureCode", () => {
  test("reads the code off a classified failure", () => {
    const error = new SignInError({ cause: undefined, code: "AUTH_004" });

    expect(getSignInFailureCode(error)).toBe("AUTH_004");
  });

  test("still shows something for a failure that escaped classification", () => {
    expect(getSignInFailureCode(new Error("unhandled"))).toBe("SYS_002");
  });
});

describe("SignInError", () => {
  test("carries the code and the failure it came from", () => {
    const cause = new Error("Invalid credentials");
    const error = new SignInError({ cause, code: "AUTH_002" });

    expect(error.code).toBe("AUTH_002");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("SignInError");
  });
});
