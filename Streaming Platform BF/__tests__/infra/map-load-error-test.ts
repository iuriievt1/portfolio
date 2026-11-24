import { mapLoadErrorToCode } from "@/infra/error";
import { setDeviceOffline } from "@/infra/error/connectivity-store";

describe("mapLoadErrorToCode", () => {
  afterEach(() => {
    setDeviceOffline(false);
  });

  test("reads a request that never reached the service as an unreachable server", () => {
    expect(mapLoadErrorToCode(new TypeError("Network request failed"))).toBe(
      "NET_003",
    );
  });

  test("reads a flattened transport message as an unreachable server", () => {
    expect(mapLoadErrorToCode("Network request failed")).toBe("NET_003");
  });

  test("reads the same failure as offline while the device has no connection", () => {
    setDeviceOffline(true);

    expect(mapLoadErrorToCode(new TypeError("Network request failed"))).toBe(
      "NET_001",
    );
  });

  test("reads a server failure as an unreachable server", () => {
    expect(mapLoadErrorToCode({ status: 500 })).toBe("NET_003");
    expect(mapLoadErrorToCode({ status: 502 })).toBe("NET_003");
    expect(mapLoadErrorToCode({ status: 503 })).toBe("NET_003");
    expect(mapLoadErrorToCode({ status: 429 })).toBe("NET_003");
  });

  test("reads a timeout as the timed-out code", () => {
    expect(mapLoadErrorToCode({ status: 408 })).toBe("NET_004");
    expect(mapLoadErrorToCode({ status: 504 })).toBe("NET_004");
    expect(mapLoadErrorToCode(new Error("Request timed out: GET /page"))).toBe(
      "NET_004",
    );
  });

  test("reads a missing or withdrawn title as content unavailable", () => {
    expect(mapLoadErrorToCode({ status: 404 })).toBe("PLAY_002");
    expect(mapLoadErrorToCode({ status: 410 })).toBe("PLAY_002");
  });

  test("falls back to the unexpected-issue code", () => {
    expect(mapLoadErrorToCode(new Error("Request failed"))).toBe("SYS_002");
    expect(mapLoadErrorToCode({ status: 400 })).toBe("SYS_002");
    expect(mapLoadErrorToCode(undefined)).toBe("SYS_002");
  });
});
