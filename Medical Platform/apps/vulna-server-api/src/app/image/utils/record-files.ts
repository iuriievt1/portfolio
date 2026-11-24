import type { RecordFileRow } from "../types/image.types"

// CAP-020-R17
export function filesByRecord(rows: readonly RecordFileRow[]): Map<string, RecordFileRow[]> {
	const byRecord = new Map<string, RecordFileRow[]>()
	for (const row of rows) {
		const files = byRecord.get(row.acquisition_id) ?? []
		files.push(row)
		byRecord.set(row.acquisition_id, files)
	}
	return byRecord
}

// CAP-020-R07, CAP-026-R06, clinical-workflow.yaml Finding.cover_image_id, PatientDocumentItem.cover_page_id
export function coverFileIdOf(files: readonly RecordFileRow[]): string | null {
	const shown = files.filter((file) => file.has_thumbnail).sort((left, right) => left.sequence - right.sequence)
	return shown[0]?.id ?? null
}

export function isImageDataAvailable(files: readonly RecordFileRow[]): boolean {
	return files.length > 0 && files.every((file) => file.is_available)
}

// clinical-workflow.yaml TimelineItem.images, CAP-020-R15, CAP-021-R40
export function isViewable(file: RecordFileRow): boolean {
	return file.is_available || file.has_viewing_copy
}
