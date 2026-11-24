import type { Config } from "@docusaurus/types";

const pagesUrl = process.env.CI_PAGES_URL || "https://example.com";
const parsedUrl = new URL(pagesUrl);

const config: Config = {
  title: "BFBS Mobile Documentation",
  tagline: "iOS and Android application documentation",
  url: parsedUrl.origin,
  baseUrl: parsedUrl.pathname.endsWith("/")
    ? parsedUrl.pathname
    : `${parsedUrl.pathname}/`,
  onBrokenLinks: "throw",
  organizationName: "bfbs",
  projectName: "bfbs-mobile-docs",
  favicon: "img/favicon.png",
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../docs",
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          numberPrefixParser: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsDir: "../docs",
        docsRouteBasePath: "/",
        searchBarPosition: "right",
      },
    ],
  ],
  themeConfig: {
    navbar: {
      logo: {
        alt: "BFBS logo",
        src: "img/bfbs-logo.png",
        href: "/",
      },
      items: [
        { to: "/", label: "Home", position: "left" },
        {
          href: "https://git.fxdigital.uk/bfbs/bfbs-mobile",
          label: "GitLab",
          position: "right",
        },
      ],
    },
  },
};

export default config;
