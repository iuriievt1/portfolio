import { PlayerErrorCode } from "@bfbs/common-sdk";
import { ERROR_CATALOGUE, errorCodes } from "@/infra/error";

describe("errorCodes", () => {
  test("keeps the Common SDK spelling for the codes the player also raises", () => {
    expect(errorCodes.contentUnavailable).toBe(
      PlayerErrorCode.CONTENT_UNAVAILABLE,
    );
    expect(errorCodes.offline).toBe(PlayerErrorCode.NETWORK_OFFLINE);
    expect(errorCodes.unexpected).toBe(PlayerErrorCode.UNEXPECTED_ERROR);
  });

  test("names the code no player error carries", () => {
    expect(errorCodes.updateRequired).toBe("SYS_001");
    expect(Object.values(PlayerErrorCode)).not.toContain("SYS_001");
  });

  test("only names codes the Error Table carries", () => {
    for (const code of Object.values(errorCodes)) {
      expect(ERROR_CATALOGUE[code]).toBeDefined();
    }
  });

  test("carries every playback code the SDK can report", () => {
    for (const code of Object.values(PlayerErrorCode)) {
      expect(ERROR_CATALOGUE[code]).toBeDefined();
    }
  });
});
