import { Platform } from "react-native";
import { reportError } from "@/infra/error";
import { featurevisorService } from "@/infra/feature-flags/featurevisor-service";
import { isDeviceIntegrityAllowed } from "../device-integrity";

const mockCheck = jest.fn();
jest.mock("@bfbs/common-sdk", () => ({
  DeviceIntegrity: { check: () => mockCheck() },
  DeviceIntegrityStatus: { FAILED: "failed" },
}));
jest.mock("@/infra/error", () => ({ reportError: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  featurevisorService.setOverrides({});
});
afterEach(() => jest.restoreAllMocks());

test.each([
  "ios",
  "android",
] as const)("runs local checks on %s", async (platform) => {
  jest.replaceProperty(Platform, "OS", platform);
  mockCheck.mockResolvedValue({ status: "failed" });
  await expect(isDeviceIntegrityAllowed()).resolves.toBe(false);
  expect(mockCheck).toHaveBeenCalledTimes(1);
  expect(reportError).not.toHaveBeenCalled();
});

test.each(["passed", "inconclusive"])("allows %s", async (status) => {
  mockCheck.mockResolvedValue({ status });
  await expect(isDeviceIntegrityAllowed()).resolves.toBe(true);
  expect(reportError).not.toHaveBeenCalled();
});

test("reports unexpected integrity exceptions while allowing access", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const error = new Error("Integrity service not configured");
  mockCheck.mockRejectedValue(error);
  await expect(isDeviceIntegrityAllowed()).resolves.toBe(true);
  expect(reportError).toHaveBeenCalledWith(error, {
    tags: { area: "auth", operation: "device_integrity_check" },
  });
  expect(warn).toHaveBeenCalledWith(
    "Device integrity check unavailable; allowing access.",
  );
});

test("skips the unsupported web platform", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  await expect(isDeviceIntegrityAllowed()).resolves.toBe(true);
  expect(mockCheck).not.toHaveBeenCalled();
});
