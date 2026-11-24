export const featureFlagKeys = {
  deviceIntegrity: "auth.deviceIntegrity",
  minimumAppVersion: "app.minimumVersion",
  navbarProfileIcon: "ui.navbarProfileIcon",
} as const;

export type FeatureFlagKey =
  (typeof featureFlagKeys)[keyof typeof featureFlagKeys];
