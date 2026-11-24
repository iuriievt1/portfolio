const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");
const config = getSentryExpoConfig(__dirname);
const isStorybook = process.env.EXPO_PUBLIC_ENVIRONMENT === "storybook";

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
};

const nativeWindConfig = withNativeWind(config, { input: "./global.css" });

if (isStorybook) {
  const {
    withStorybook,
  } = require("@storybook/react-native/metro/withStorybook");

  module.exports = withStorybook(nativeWindConfig);
} else {
  module.exports = nativeWindConfig;
}
