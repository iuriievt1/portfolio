const mockGetVariable = jest.fn();
const mockGetAppVersionMetadata = jest.fn();

jest.mock("@/infra/feature-flags/featurevisor-service", () => ({
  featurevisorService: {
    getVariable: (key: string, variableKey: string) =>
      mockGetVariable(key, variableKey),
  },
}));

jest.mock("@/infra/app-version/app-version-metadata", () => ({
  getAppVersionMetadata: () => mockGetAppVersionMetadata(),
}));

import {
  getMinimumAppVersion,
  isAppUpdateRequired,
  isVersionBelow,
} from "@/infra/app-version/minimum-app-version";

describe("isVersionBelow", () => {
  test.each([
    ["1.2.3", "1.2.4", true],
    ["1.2.3", "1.3.0", true],
    ["1.2.3", "2.0.0", true],
    ["1.2.3", "1.2.3", false],
    ["1.2.4", "1.2.3", false],
    ["2.0.0", "1.9.9", false],
    ["1.2", "1.2.0", false],
    ["1.2", "1.2.1", true],
  ])("compares %s against %s", (version, minimum, expected) => {
    expect(isVersionBelow({ minimumVersion: minimum, version })).toBe(expected);
  });
});

describe("isAppUpdateRequired", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppVersionMetadata.mockReturnValue({ version: "1.2.3" });
  });

  test("reads the minimum from the feature flag variable", () => {
    mockGetVariable.mockReturnValue("1.5.0");

    expect(getMinimumAppVersion()).toBe("1.5.0");
    expect(mockGetVariable).toHaveBeenCalledWith(
      "app.minimumVersion",
      "version",
    );
  });

  test("asks for an update when the build is older than the minimum", () => {
    mockGetVariable.mockReturnValue("1.5.0");

    expect(isAppUpdateRequired()).toBe(true);
  });

  test("stays quiet when the build meets the minimum", () => {
    mockGetVariable.mockReturnValue("1.0.0");

    expect(isAppUpdateRequired()).toBe(false);
  });

  test("stays quiet when no minimum is published", () => {
    mockGetVariable.mockReturnValue(undefined);

    expect(isAppUpdateRequired()).toBe(false);
  });

  test("ignores a minimum that is not a version string", () => {
    mockGetVariable.mockReturnValue(42);

    expect(getMinimumAppVersion()).toBeUndefined();
    expect(isAppUpdateRequired()).toBe(false);
  });
});
