const { rmSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");

const {
  getReportExitCode,
  isCompleteHtmlReport,
} = require("../react-compiler-report");

describe("react compiler report", () => {
  const reportPath = join(
    tmpdir(),
    `react-compiler-report-${process.pid}.html`,
  );

  afterAll(() => {
    rmSync(reportPath, { force: true });
  });

  it("accepts a complete HTML report", () => {
    writeFileSync(reportPath, "<!DOCTYPE html><html></html>");

    expect(isCompleteHtmlReport(reportPath)).toBe(true);
  });

  it("rejects a truncated HTML report", () => {
    writeFileSync(reportPath, "<!DOCTYPE html><html>");

    expect(isCompleteHtmlReport(reportPath)).toBe(false);
  });

  it("treats compiler findings as successful only with a complete report", () => {
    expect(getReportExitCode(1, true)).toBe(0);
    expect(getReportExitCode(1, false)).toBe(1);
  });

  it("preserves unexpected failures", () => {
    expect(getReportExitCode(2, true)).toBe(2);
    expect(getReportExitCode(null, false)).toBe(1);
  });
});
