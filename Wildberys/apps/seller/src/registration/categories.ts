import type { CategorySection } from '@bluberi/api-client';

/**
 * What a seller ticks in a section: its subcategories. A section that is not split
 * is ticked as a whole.
 */
export function choicesOf(section: CategorySection): string[] {
  return section.subcategories.length > 0
    ? section.subcategories.map(({ id }) => id)
    : [section.id];
}

/**
 * The saved categories of a store as ticks. The API keeps a section in place of all of its
 * subcategories, so a saved section ticks every one of them.
 */
export function toChoices(
  sections: readonly CategorySection[],
  categoryIds: readonly string[],
): string[] {
  const saved = new Set(categoryIds);

  return sections.flatMap((section) =>
    saved.has(section.id) ? choicesOf(section) : choicesOf(section).filter((id) => saved.has(id)),
  );
}
