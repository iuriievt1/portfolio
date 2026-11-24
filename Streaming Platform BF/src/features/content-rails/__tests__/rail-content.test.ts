import {
  ContentCategoryTemplate,
  type ContentItem,
  type ContentRail,
} from "@bfbs/common-sdk";

import {
  getDisplayedTiles,
  shouldShowViewAll,
} from "@/features/content-rails/utils/rail-content";

function createItems(count: number): ContentItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index + 1}`,
    title: `Item ${index + 1}`,
  }));
}

function createRail({
  itemCount,
  maxItems,
  template = ContentCategoryTemplate.SIXTEEN_BY_NINE_DESIGNED_SMALL,
}: {
  itemCount: number;
  maxItems?: number;
  template?: ContentCategoryTemplate;
}): ContentRail {
  return {
    category: { id: "test-rail", name: "Test rail", type: "swimlane" },
    ...(maxItems === undefined ? {} : { contentDisplay: { maxItems } }),
    items: createItems(itemCount),
    metadata: { count: itemCount, total: itemCount },
    template,
  };
}

describe("Top 10 rails", () => {
  it("show the first 10 items in GO's order when GO sends more", () => {
    const rail = createRail({ itemCount: 15, maxItems: 15 });

    expect(getDisplayedTiles(rail).map(({ id }) => id)).toEqual(
      createItems(10).map(({ id }) => id),
    );
  });

  it("stop at 10 when GO leaves out the maximum", () => {
    expect(getDisplayedTiles(createRail({ itemCount: 15 }))).toHaveLength(10);
  });

  it("keep a smaller maximum from GO", () => {
    expect(
      getDisplayedTiles(createRail({ itemCount: 15, maxItems: 5 })),
    ).toHaveLength(5);
  });

  it("never offer View all", () => {
    expect(shouldShowViewAll(createRail({ itemCount: 15 }))).toBe(false);
  });
});

describe("other rails", () => {
  const template = ContentCategoryTemplate.SIXTEEN_BY_NINE_STANDARD;

  it("use GO's maximum, or 15 when it is missing", () => {
    expect(
      getDisplayedTiles(createRail({ itemCount: 20, maxItems: 12, template })),
    ).toHaveLength(12);
    expect(
      getDisplayedTiles(createRail({ itemCount: 20, template })),
    ).toHaveLength(15);
  });

  it("offer View all when items are hidden", () => {
    expect(shouldShowViewAll(createRail({ itemCount: 20, template }))).toBe(
      true,
    );
  });
});
