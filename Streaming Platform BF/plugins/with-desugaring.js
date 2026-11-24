/**
 * Enables core library desugaring for the Android app.
 * Required by com.google.ads.interactivemedia (used by Bitmovin) which uses
 * Java 8+ APIs that aren't available on older Android versions (minSdk 24).
 * Adds coreLibraryDesugaringEnabled to compileOptions and the desugar_jdk_libs
 * dependency — both are needed or the build fails.
 */

const { withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withDesugaring(config) {
  return withAppBuildGradle(config, (appBuildGradleConfig) => {
    let contents = appBuildGradleConfig.modResults.contents;

    if (!contents.includes("coreLibraryDesugaringEnabled")) {
      contents = contents.replace(
        /^(android\s*\{[\s\S]*?)(^\})/m,
        `$1    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_1_8\n        targetCompatibility JavaVersion.VERSION_1_8\n    }\n$2`,
      );
    }

    if (!contents.includes("desugar_jdk_libs")) {
      contents = contents.replace(
        /^(dependencies\s*\{)/m,
        `$1\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'`,
      );
    }

    appBuildGradleConfig.modResults.contents = contents;
    return appBuildGradleConfig;
  });
};
