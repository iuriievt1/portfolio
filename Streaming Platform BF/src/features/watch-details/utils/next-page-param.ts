import type { ContentItem, ContentList } from "@bfbs/common-sdk";

/** Where a page starts: after the provider's end locator, or at an offset. */
export type PageParam = { locator?: string; offset: number };

export const FIRST_PAGE_PARAM: PageParam = { offset: 0 };

// A missing list is read as empty.
function getPageItems(page: ContentList): readonly ContentItem[] {
  return page.items ?? [];
}

/**
 * The next page to load, or undefined when the list is done.
 * `total` can be page-sized while more items exist, so it is not trusted:
 * the list ends on a page with no new items or a repeated locator.
 */
export function getNextPageParam(
  lastPage: ContentList,
  pages: readonly ContentList[],
): PageParam | undefined {
  const earlierPages = pages.slice(0, -1);
  const seenIds = new Set(
    earlierPages.flatMap((page) => getPageItems(page).map((item) => item.id)),
  );

  if (!getPageItems(lastPage).some((item) => !seenIds.has(item.id))) {
    return undefined;
  }

  const endLocator = lastPage.metadata?.locators?.end;

  if (endLocator) {
    // A repeated locator would load the same page again.
    const isRepeated = earlierPages.some(
      (page) => page.metadata?.locators?.end === endLocator,
    );

    return isRepeated ? undefined : { locator: endLocator, offset: 1 };
  }

  const loadedCount = pages.reduce(
    (count, page) => count + getPageItems(page).length,
    0,
  );

  return { offset: loadedCount };
}

/** Every page's items in order, each item once. */
export function collectPageItems(pages: readonly ContentList[]): ContentItem[] {
  const seenIds = new Set<string>();

  return pages.flatMap((page) =>
    getPageItems(page).filter((item) => {
      if (seenIds.has(item.id)) {
        return false;
      }

      seenIds.add(item.id);

      return true;
    }),
  );
}
