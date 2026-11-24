import type { ConfirmedRenditionRow, FileRenditionRow } from "../types/clinical-record.types"

// CAP-021-R36, CAP-021-R37, CAP-021-R39
export function confirmedOf(row: FileRenditionRow | null): ConfirmedRenditionRow | undefined {
	if (row === null) {
		return undefined
	}
	const { clinical_record_binary_id: binaryId, clinical_record_uploaded_at: uploadedAt } = row
	if (binaryId === null || uploadedAt === null) {
		return undefined
	}
	return { ...row, clinical_record_binary_id: binaryId, clinical_record_uploaded_at: uploadedAt }
}
