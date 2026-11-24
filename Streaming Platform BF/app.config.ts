import { execFileSync } from "node:child_process";
import type { ConfigContext, ExpoConfig } from "expo/config";
import packageJson from "./package.json";

const productionApplicationId = "com.bfbs.player";
const mobileDevApplicationId = `${productionApplicationId}.dev`;
const releaseApplicationId =
  process.env.RELEASE_APP_IDENTIFIER ?? "com.bfbs.hub";
const expoProjectId = process.env.EXPO_PROJECT_ID;

const iosApplicationId = (() => {
  switch (process.env.APP_VARIANT) {
    case "mobile-dev":
      return mobileDevApplicationId;
    case "release-test-ios":
      return releaseApplicationId;
    default:
      return productionApplicationId;
  }
})();

const androidApplicationId = (() => {
  switch (process.env.APP_VARIANT) {
    case "mobile-dev":
      return mobileDevApplicationId;
    case "release-test-google-play":
    case "release-test-amazon-appstore":
      return releaseApplicationId;
    default:
      return productionApplicationId;
  }
})();

const getLocalCommitShortHash = () => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const reason =
      error instanceof Error && "stderr" in error && error.stderr
        ? String(error.stderr).trim()
        : error;

    console.warn(
      '[app.config] Could not resolve the local git commit hash, falling back to "unknown". ' +
        "Set APP_COMMIT_HASH to identify this build.",
      reason,
    );

    return "unknown";
  }
};

const buildNumber = (() => {
  const value =
    process.env.APP_BUILD_NUMBER ??
    process.env.CI_JOB_ID ??
    process.env.CI_PIPELINE_IID;

  if (!value) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? 1 : parsed;
})();

const appCommitHash = process.env.APP_COMMIT_HASH ?? getLocalCommitShortHash();

/**
 * GitLab environment reported in build metadata. CI builds report
 * `production/android` or `production/ios`; developer builds report `local`.
 */
const appEnvironment = process.env.APP_ENVIRONMENT || "local";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "BFBS Hub",
  slug: "bfbs-player-mobile",
  version: packageJson.version,
  icon: "./assets/images/icon.png",
  scheme: "bfbsmobile",
  userInterfaceStyle: "automatic",
  ios: {
    buildNumber: String(buildNumber),
    bundleIdentifier: iosApplicationId,
    icon: "./assets/images/icon.png",
    infoPlist: {
      UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
    },
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#074F71",
      foregroundImage: "./assets/images/android-icon-foreground.png",
    },
    package: androidApplicationId,
    predictiveBackGestureEnabled: false,
    versionCode: buildNumber,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-screen-orientation",
    "@sentry/react-native/expo",
    "./plugins/with-desugaring.js",
    "./plugins/with-bitmovin-repo.js",
    "./plugins/with-ios-audio-session.js",
    "./plugins/with-android-portrait-on-phones.js",
    [
      "bitmovin-player-react-native",
      {
        playerLicenseKey: process.env.EXPO_PUBLIC_BITMOVIN_PLAYER_LICENSE_KEY,
        features: {
          googleCastSDK: { android: "21.3.0", ios: "4.8.1.2" },
          pictureInPicture: true,
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/images/mock-splash-screen.png",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...config.extra,
    appVersion: {
      buildId: buildNumber,
      commitHash: appCommitHash,
      environment: appEnvironment,
      version: packageJson.version,
    },
    ...(expoProjectId
      ? {
          eas: {
            ...config.extra?.eas,
            projectId: expoProjectId,
          },
        }
      : {}),
  },
});
