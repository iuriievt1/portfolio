import { render } from "@testing-library/react-native";
import Constants from "expo-constants";

import {
  AppVersion,
  formatAppVersion,
  getAppVersionMetadata,
} from "@/infra/app-version";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

const setAppVersionExtra = (
  appVersion: Record<string, unknown> | undefined,
) => {
  (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig =
    { extra: appVersion ? { appVersion } : {} };
};

const buildMetadata = {
  buildId: 123,
  commitHash: "abc1234",
  environment: "wz",
  version: "2.2.0",
};

describe("getAppVersionMetadata", () => {
  it("reads the metadata injected by app.config.ts", () => {
    setAppVersionExtra(buildMetadata);

    expect(getAppVersionMetadata()).toEqual(buildMetadata);
  });

  it("falls back to local defaults when the config is missing", () => {
    setAppVersionExtra(undefined);

    expect(getAppVersionMetadata()).toEqual({
      buildId: "local",
      commitHash: "unknown",
      environment: "local",
      version: "0.0.0",
    });
  });

  it("fills in only the fields the config omits", () => {
    setAppVersionExtra({ version: "2.2.0" });

    expect(getAppVersionMetadata()).toEqual({
      buildId: "local",
      commitHash: "unknown",
      environment: "local",
      version: "2.2.0",
    });
  });
});

describe("formatAppVersion", () => {
  it("formats as <MAJOR>.<MINOR>.<PATCH> (<BUILD_ID>.<COMMIT_HASH>)", () => {
    expect(formatAppVersion(buildMetadata)).toBe("2.2.0 (123.abc1234)");
  });
});

describe("AppVersion", () => {
  it("displays the version, build metadata and environment", () => {
    setAppVersionExtra(buildMetadata);

    const { getByText } = render(<AppVersion />);

    expect(getByText("App version: 2.2.0 (123.abc1234)")).toBeTruthy();
    expect(getByText("Environment: wz")).toBeTruthy();
  });

  it("falls back to local build metadata when the config is missing", () => {
    setAppVersionExtra(undefined);

    const { getByText } = render(<AppVersion />);

    expect(getByText("App version: 0.0.0 (local.unknown)")).toBeTruthy();
    expect(getByText("Environment: local")).toBeTruthy();
  });
});
