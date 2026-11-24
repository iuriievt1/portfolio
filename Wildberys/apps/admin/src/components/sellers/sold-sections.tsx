import type { SoldSection } from '@bluberi/api-client';

interface SoldSectionsProps {
  /** What the store sells, section by section. */
  readonly sections: readonly SoldSection[];
  /** The words in the brackets of a section the store sells whole. */
  readonly wholeSection: string;
  /** In one line, for a row of a list. Otherwise every section has a line of its own. */
  readonly inline?: boolean;
}

/**
 * What a store sells: the name of every section, and in brackets after it the subcategories
 * the store chose there, or the words for the whole section.
 */
export function SoldSections({ sections, wholeSection, inline = false }: SoldSectionsProps) {
  const Row = inline ? 'span' : 'li';
  const rows = sections.map(({ section, subcategories }, index) => (
    <Row key={section}>
      {inline && index > 0 ? <span className="text-gray-400"> · </span> : null}
      <span className="font-bold text-berry-950">{section}</span>{' '}
      <span className="font-medium text-gray-600">
        ({subcategories.length > 0 ? subcategories.join(', ') : wholeSection})
      </span>
    </Row>
  ));

  return inline ? rows : <ul className="flex flex-col gap-1">{rows}</ul>;
}
