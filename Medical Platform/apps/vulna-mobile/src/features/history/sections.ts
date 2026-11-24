export interface Section<T> {
	key: string
	items: T[]
}

export const SECTION_ROW = {
	HEADER: "header",
	ITEM: "item",
} as const

export type SectionRow<T> =
	| { kind: typeof SECTION_ROW.HEADER; key: string; title: string; isFirst: boolean }
	| { kind: typeof SECTION_ROW.ITEM; key: string; item: T }

// E109, E110
export function sectionRowsOf<T, S extends Section<T>>(
	sections: readonly S[],
	titleOf: (section: S) => string,
	keyOf: (item: T) => string,
): SectionRow<T>[] {
	return sections.flatMap((section, index): SectionRow<T>[] => [
		{ kind: SECTION_ROW.HEADER, key: `section:${section.key}`, title: titleOf(section), isFirst: index === 0 },
		...section.items.map((item): SectionRow<T> => ({ kind: SECTION_ROW.ITEM, key: keyOf(item), item })),
	])
}

// E109, E110
export function sectionsInOrder<T>(items: readonly T[], keyOf: (item: T) => string): Section<T>[] {
	const sections: Section<T>[] = []
	for (const item of items) {
		const key = keyOf(item)
		const last = sections.at(-1)
		if (last?.key === key) {
			last.items.push(item)
			continue
		}
		sections.push({ key, items: [item] })
	}
	return sections
}

// CAP-015-R28
export function capitalizedOf(text: string, language: string): string {
	return `${text.charAt(0).toLocaleUpperCase(language)}${text.slice(1)}`
}
