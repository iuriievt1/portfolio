import type { MobileContract } from "@ansora/contracts"

export type EditKind = MobileContract.components["schemas"]["AcquisitionFileReplacement"]["edit"]

// clinical-workflow.yaml AcquisitionFileReplacement, CAP-015-R34
export const EDIT_KIND = {
	ROTATION: "rotation",
	CROP: "crop",
	ROTATION_AND_CROP: "rotation_and_crop",
} as const satisfies Record<string, EditKind>

// clinical-workflow.yaml AcquisitionFileReplacement.edit, CAP-015-R34
export function mergedEditKindOf(previous: EditKind | null, next: EditKind): EditKind {
	if (previous === null || previous === next) {
		return next
	}
	return EDIT_KIND.ROTATION_AND_CROP
}
