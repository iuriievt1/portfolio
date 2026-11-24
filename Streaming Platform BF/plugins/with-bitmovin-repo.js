/**
 * Adds Bitmovin's private Maven repository to the Android project.
 * The Bitmovin player SDK is not published to any public Maven repo
 * (Google, Maven Central, JitPack), so without this the build fails
 * with "Could not find com.bitmovin.player:player:x.x.x".
 */

const { withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withBitmovinRepo(config) {
  return withProjectBuildGradle(config, (projectBuildGradleConfig) => {
    let contents = projectBuildGradleConfig.modResults.contents;

    if (!contents.includes("artifacts.bitmovin.com")) {
      contents = contents.replace(
        /maven\s*\{\s*url\s*=?\s*["']https:\/\/www\.jitpack\.io["']\s*\}/,
        `maven { url 'https://www.jitpack.io' }\n        maven { url 'https://artifacts.bitmovin.com/artifactory/public-releases' }`,
      );
    }

    projectBuildGradleConfig.modResults.contents = contents;
    return projectBuildGradleConfig;
  });
};
