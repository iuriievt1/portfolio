import { cryptoAndKeys } from "@ansora/core-mobile"
import type { AcquisitionDraft } from "../../api/acquisitions"

function canonicalJsonOf(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJsonOf).join(",")}]`
	}
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value ?? null)
	}
	const fields = Object.entries(value)
		.filter(([, field]) => field !== undefined)
		.sort(([first], [second]) => (first < second ? -1 : 1))
		.map(([key, field]) => `${JSON.stringify(key)}:${canonicalJsonOf(field)}`)
	return `{${fields.join(",")}}`
}

// CAP-021-R32, CAP-019-R29, E115
export function confirmedContentOf(draft: AcquisitionDraft): string {
	return canonicalJsonOf({
		patient_id: draft.patient.patient_id,
		encounter_id: draft.encounter?.encounter_id ?? null,
		finding_id: draft.finding_id ?? null,
		wound_type_code: draft.wound_type_code ?? null,
		body_site: draft.body_site ?? null,
		assessment: draft.assessment ?? null,
		document_title: draft.document_title ?? null,
	})
}

// CAP-019-R10, CAP-019-R29
export async function contentFingerprintOf(draft: AcquisitionDraft): Promise<string> {
	return await cryptoAndKeys().sha256Text(confirmedContentOf(draft))
}
