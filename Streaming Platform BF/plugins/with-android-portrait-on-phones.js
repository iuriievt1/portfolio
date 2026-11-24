/**
 * Locks Android phones to portrait at launch so the splash screen never appears
 * in landscape, while tablets (>= 600dp smallest width) keep rotating.
 *
 * The player still forces landscape at runtime through
 * `setRequestedOrientation`, which overrides this launch-time lock.
 */

const { withMainActivity } = require("@expo/config-plugins");

const IMPORT_ANCHOR = "import android.os.Bundle";
const IMPORT_LINE = "import android.content.pm.ActivityInfo";

const BODY_ANCHOR = "super.onCreate(null)";
const ORIENTATION_SETUP = `
    if (resources.configuration.smallestScreenWidthDp < 600) {
      requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    }`;

module.exports = function withAndroidPortraitOnPhones(config) {
  return withMainActivity(config, (mainActivityConfig) => {
    let contents = mainActivityConfig.modResults.contents;

    if (!contents.includes(IMPORT_LINE)) {
      contents = contents.replace(
        IMPORT_ANCHOR,
        `${IMPORT_ANCHOR}\n${IMPORT_LINE}`,
      );
    }

    if (!contents.includes("SCREEN_ORIENTATION_PORTRAIT")) {
      contents = contents.replace(
        BODY_ANCHOR,
        `${BODY_ANCHOR}\n${ORIENTATION_SETUP}`,
      );
    }

    mainActivityConfig.modResults.contents = contents;
    return mainActivityConfig;
  });
};
