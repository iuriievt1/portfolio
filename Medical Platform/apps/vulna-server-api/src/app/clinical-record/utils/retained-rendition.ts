import type { ClinicalArchivedFile } from "@ansora/vulna-domain"
import type { ConfirmedRenditionRow, FileRenditionRow, KeptOrArchived } from "../types/clinical-record.types"
import { confirmedOf } from "./confirmed-rendition"

// CAP-026-R19, ADR-050 bod 14
function isDetaching(row: FileRenditionRow): boolean {
	return row.retention_due_at !== null
}

export function archivedOf(contentType: string, sha256: string | null): ClinicalArchivedFile {
	return { contentType, sha256: sha256 ?? undefined }
}

export function isKept(content: KeptOrArchived): content is ConfirmedRenditionRow {
	return "binary_object_id" in content
}

// CAP-021-R37, CAP-026-R02, CAP-026-R20
export function keptOf(row: FileRenditionRow | null): ConfirmedRenditionRow | undefined {
	const confirmed = confirmedOf(row)
	return confirmed === undefined || isDetaching(confirmed) ? undefined : confirmed
}

// CAP-021-R37, CAP-026-R19, CAP-026-R20
export function keptOrArchivedOf(
	row: FileRenditionRow | null,
	deletedAt: Date | null,
	contentType: string,
	fileSha256: string | null,
): KeptOrArchived | undefined {
	if (row === null) {
		return deletedAt instanceof Date ? archivedOf(contentType, fileSha256) : undefined
	}
	const confirmed = confirmedOf(row)
	if (confirmed === undefined) {
		return undefined
	}
	return isDetaching(confirmed) ? archivedOf(contentType, confirmed.sha256) : confirmed
}

// CAP-026-R19, ADR-050 bod 14
export function detachingOf(rows: readonly (FileRenditionRow | null)[]): string[] {
	return rows.flatMap((row) => (row !== null && isDetaching(row) ? [row.binary_object_id] : []))
}
