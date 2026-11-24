import type { ContentItem } from "@bfbs/common-sdk";
import {
  formatCredits,
  getContentWarning,
} from "@/features/watch-details/utils/more-details";

describe("formatCredits", () => {
  test("joins non-empty names", () => {
    expect(formatCredits(["Alice", "Bob"])).toBe("Alice, Bob");
  });

  test("drops empty names", () => {
    expect(formatCredits(["Alice", "", "Bob"])).toBe("Alice, Bob");
  });

  test("returns undefined for missing or empty lists", () => {
    expect(formatCredits(undefined)).toBeUndefined();
    expect(formatCredits([])).toBeUndefined();
    expect(formatCredits(["", ""])).toBeUndefined();
  });
});

describe("getContentWarning", () => {
  const base: ContentItem = { id: "1", title: "T" };

  test("joins advisory labels", () => {
    expect(
      getContentWarning({
        ...base,
        contentAdvisories: [{ label: "Violence" }, { label: "Adult Language" }],
      }),
    ).toBe("Violence, Adult Language");
  });

  test("ignores advisories without a label", () => {
    expect(
      getContentWarning({ ...base, contentAdvisories: [{ code: "x" }] }),
    ).toBeUndefined();
  });

  test("returns undefined when there are no advisories", () => {
    expect(getContentWarning(base)).toBeUndefined();
  });
});
