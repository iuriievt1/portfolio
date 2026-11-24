import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    "index",
    {
      type: "category",
      label: "Getting Started",
      items: ["contributing"],
    },
    {
      type: "category",
      label: "Architecture",
      items: [
        "top-navigation",
        "splash-screen",
        "authentication-system",
        "video-player",
      ],
    },
    {
      type: "category",
      label: "Integrations",
      items: ["sentry-integration", "fastlane", "storybook-integration"],
    },
    "debugging",
  ],
};

export default sidebars;
