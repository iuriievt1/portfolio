const { readFileSync, rmSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { spawnSync } = require("node:child_process");

const reportFilename = "react-compiler-report.html";

/**
 * Checks that React Compiler Marker finished writing a complete HTML report.
 *
 * @param {string} reportPath Path to the generated report.
 * @returns {boolean} Whether the report has the expected document boundaries.
 */
function isCompleteHtmlReport(reportPath) {
  try {
    const report = readFileSync(reportPath, "utf8").trim();

    return report.startsWith("<!DOCTYPE html>") && report.endsWith("</html>");
  } catch {
    return false;
  }
}

/**
 * Maps React Compiler Marker's result to the report command's exit code.
 * Marker uses exit code 1 for a valid report containing compiler findings.
 *
 * @param {number | null} markerExitCode Exit code returned by Marker.
 * @param {boolean} hasCompleteReport Whether Marker wrote a complete report.
 * @returns {number} Exit code for the developer-facing report command.
 */
function getReportExitCode(markerExitCode, hasCompleteReport) {
  if (markerExitCode === 0 || (markerExitCode === 1 && hasCompleteReport)) {
    return 0;
  }

  return markerExitCode ?? 1;
}

/**
 * Generates the React Compiler Marker HTML report for this repository.
 *
 * @returns {number} Process exit code.
 */
function runReactCompilerReport() {
  const projectRoot = join(__dirname, "..");
  const reportPath = join(projectRoot, reportFilename);
  const markerCli = join(
    dirname(require.resolve("react-compiler-marker/package.json")),
    "bin/cli.js",
  );

  rmSync(reportPath, { force: true });

  const result = spawnSync(
    process.execPath,
    [
      markerCli,
      "--babel-plugin-path",
      join(projectRoot, "node_modules/babel-plugin-react-compiler"),
      "--format",
      "html",
      "--output",
      reportFilename,
      "src",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );

  if (result.error) {
    console.error("Failed to run React Compiler Marker.", result.error);
    return 1;
  }

  return getReportExitCode(result.status, isCompleteHtmlReport(reportPath));
}

if (require.main === module) {
  process.exitCode = runReactCompilerReport();
}

module.exports = { getReportExitCode, isCompleteHtmlReport };
