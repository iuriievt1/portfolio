import type { AcquisitionDraft } from "../../api/acquisitions"

// CAP-015-R35, CAP-021-R32, E115
export function isChangedOnlyInFiles(known: AcquisitionDraft, fresh: AcquisitionDraft): boolean {
	return JSON.stringify(withoutFiles(known)) === JSON.stringify(withoutFiles(fresh))
}

function withoutFiles({ files, version, updated_at, ...rest }: AcquisitionDraft) {
	return rest
}
