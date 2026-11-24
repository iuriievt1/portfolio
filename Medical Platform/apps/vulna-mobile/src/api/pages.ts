interface ContractPage<T> {
	items?: readonly T[]
	next_cursor?: string | null
}

export interface LoadedPage<T> {
	items: readonly T[]
	nextCursor: string | undefined
}

// ADR-012
export async function readAllPages<T>(read: (cursor: string | undefined) => Promise<ContractPage<T>>): Promise<T[]> {
	const items: T[] = []
	let cursor: string | undefined
	do {
		const page = await read(cursor)
		items.push(...(page.items ?? []))
		cursor = page.next_cursor ?? undefined
	} while (cursor !== undefined)
	return items
}

// ADR-012
export function loadedPageOf<T>(page: ContractPage<T>): LoadedPage<T> {
	return { items: page.items ?? [], nextCursor: page.next_cursor ?? undefined }
}
