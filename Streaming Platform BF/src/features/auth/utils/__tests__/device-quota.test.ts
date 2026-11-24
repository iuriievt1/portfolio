const mockGetDeviceLimits = jest.fn();

jest.mock("@bfbs/common-sdk", () => ({
  DeviceManager: { getDeviceLimits: () => mockGetDeviceLimits() },
}));

import { isDeviceQuotaReached } from "../device-quota";

const devices = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `device-${index}` }));

describe("isDeviceQuotaReached", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is true when the household has reached its limit", async () => {
    mockGetDeviceLimits.mockResolvedValue({
      devices: devices(5),
      maxDeviceCount: 5,
    });

    await expect(isDeviceQuotaReached()).resolves.toBe(true);
  });

  it("is false when there is still space", async () => {
    mockGetDeviceLimits.mockResolvedValue({
      devices: devices(4),
      maxDeviceCount: 5,
    });

    await expect(isDeviceQuotaReached()).resolves.toBe(false);
  });

  it("is false when the household has no limit", async () => {
    mockGetDeviceLimits.mockResolvedValue({ devices: devices(9) });

    await expect(isDeviceQuotaReached()).resolves.toBe(false);
  });

  it("is false when the limit can't be read", async () => {
    mockGetDeviceLimits.mockRejectedValue(new Error("offline"));

    await expect(isDeviceQuotaReached()).resolves.toBe(false);
  });
});
