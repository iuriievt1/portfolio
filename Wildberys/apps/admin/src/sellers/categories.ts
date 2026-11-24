import type { SoldSection } from '@bluberi/api-client';

/**
 * A section a store sells in, with what it sells there in brackets:
 * "Kosmetika (Péče o pleť, Vlasy)", or the words for the whole section.
 */
export function sectionLine({ section, subcategories }: SoldSection, wholeSection: string): string {
  return `${section} (${subcategories.length > 0 ? subcategories.join(', ') : wholeSection})`;
}
