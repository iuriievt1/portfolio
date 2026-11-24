const mockOpenURL = jest.fn();
const mockReportError = jest.fn();

jest.mock("expo-linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock("@/infra/error/utils/report-error", () => ({
  reportError: (error: unknown, context: unknown) =>
    mockReportError(error, context),
}));

import { openExternalUrl } from "@/utils/external-url";

const TAGS = { area: "auth", operation: "reset_password" };
const TEST_URL = "https://defence-gateway.example/forgotPassword";

describe("openExternalUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reports the link as opened", async () => {
    mockOpenURL.mockResolvedValue(true);

    await expect(openExternalUrl({ tags: TAGS, url: TEST_URL })).resolves.toBe(
      true,
    );

    expect(mockOpenURL).toHaveBeenCalledWith(TEST_URL);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  test("reports a refusal instead of throwing", async () => {
    const error = new Error("No browser");
    mockOpenURL.mockRejectedValue(error);

    await expect(openExternalUrl({ tags: TAGS, url: TEST_URL })).resolves.toBe(
      false,
    );

    expect(mockReportError).toHaveBeenCalledWith(error, { tags: TAGS });
  });
});
