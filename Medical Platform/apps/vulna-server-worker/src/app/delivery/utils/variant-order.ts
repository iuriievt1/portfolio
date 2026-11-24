import type { StoredVariantRow } from "../types/delivery.types"

// CAP-023-R15, integrace-dicom.md 3, 6.1
export function orderedByPreference(
	rows: readonly StoredVariantRow[],
	preference: readonly string[],
): StoredVariantRow[] {
	const rankOf = (row: StoredVariantRow) => {
		const rank = preference.indexOf(row.transfer_syntax)
		return rank === -1 ? preference.length : rank
	}
	return [...rows].sort(
		(left, right) => rankOf(left) - rankOf(right) || left.transfer_syntax.localeCompare(right.transfer_syntax),
	)
}
