import type {
  ContentCategory,
  ContentItem,
  ContentPage,
  ContentRail,
  NavigationNode,
} from "@bfbs/common-sdk";
import { ContentCategoryTemplate } from "../__mocks__/common-sdk-enums";

/** A rail's category: identity only, since placement lives on the rail. */
export const createCategory = (
  overrides: Partial<ContentCategory> & Pick<ContentCategory, "id" | "name">,
): ContentCategory => ({
  type: "content_full",
  ...overrides,
});

/** A page's category, the type navigation filters on. */
export const createPageCategory = (
  overrides: Partial<ContentCategory> & Pick<ContentCategory, "id" | "name">,
): ContentCategory => createCategory({ type: "category_list", ...overrides });

/** A rail as a page places it, hydrated unless a test says otherwise. */
export const createRail = (
  overrides: Partial<ContentRail> & Pick<ContentRail, "category">,
): ContentRail => ({
  items: [],
  template:
    ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD as ContentRail["template"],
  ...overrides,
});

/** What `getPage` resolves with. */
export const createPage = (
  category: ContentCategory,
  rails: ContentRail[] = [],
): ContentPage => ({ category, rails });

/** What `getNavigation` resolves with, one node per page. */
export const createNavigation = (pages: ContentCategory[]): NavigationNode => ({
  category: createPageCategory({ id: "root", name: "Root" }),
  children: pages.map((category) => ({ category })),
});

export const createItem = (overrides: Partial<ContentItem>): ContentItem => ({
  id: "item-1",
  title: "Item",
  ...overrides,
});
