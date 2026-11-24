import type { AcquisitionDraft, AcquisitionDraftUpdate } from "../../api/acquisitions"

// CAP-017-R02, CAP-017-R19, CAP-017-S13
export function woundTypeUpdateOf(
	draft: AcquisitionDraft,
	code: string,
	codeListVersion: string,
): AcquisitionDraftUpdate | undefined {
	if (draft.wound_type_code === code) {
		return undefined
	}
	return { wound_type_code: code, code_list_version: codeListVersion }
}

// CAP-017-R03, CAP-017-R19
export function healingPhaseUpdateOf(
	draft: AcquisitionDraft,
	code: string,
	codeListVersion: string,
): AcquisitionDraftUpdate | undefined {
	if (draft.assessment?.healing_phase_code === code) {
		return undefined
	}
	return { assessment: { healing_phase_code: code, code_list_version: codeListVersion } }
}

// CAP-017-R04, CAP-017-S04, CAP-017-R16
export function noteUpdateOf(draft: AcquisitionDraft, note: string): AcquisitionDraftUpdate | undefined {
	const assessment = draft.assessment
	const text = note.trim()
	if (text === (assessment?.description ?? "")) {
		return undefined
	}
	return { assessment: { ...assessment, description: text } }
}
