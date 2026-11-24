import { capLeading } from "@/utils/typography";

describe("capLeading", () => {
  test("trims the leading React Native adds above the caps", () => {
    expect(capLeading(14)).toBe(4);
    expect(capLeading(16)).toBe(4);
    expect(capLeading(28)).toBe(8);
  });

  test("rounds to whole pixels", () => {
    expect(capLeading(20)).toBe(6);
    expect(Number.isInteger(capLeading(13))).toBe(true);
  });

  test("leaves nothing to trim at zero", () => {
    expect(capLeading(0)).toBe(0);
  });
});
