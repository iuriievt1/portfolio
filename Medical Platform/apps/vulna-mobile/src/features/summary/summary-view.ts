import type { AcquisitionDraft } from "../../api/acquisitions"
import type { CodeListSet } from "../../api/code-lists"
import type { LocalizedNameOf } from "../../i18n/language-store"
import type { Texts } from "../../i18n/texts"
import { assessmentEyebrowOf, type ClinicalSteps } from "../assessment/clinical-steps"
import { type WoundPlace, woundPlaceOf } from "../location/body-site-text"
import { visitMomentOf, visitWhenOf } from "../visit/visit-view"
import { codeNameOf, typeAndPhaseOf } from "../wounds/wound-view"

interface SummaryAssessment {
	eyebrow: string
	value: string | undefined
}

interface SummaryView {
	visit: string
	wound: WoundPlace | undefined
	assessment: SummaryAssessment | undefined
	note: string | undefined
}

interface SummarySource {
	draft: AcquisitionDraft
	codeLists: CodeListSet
	openedAt: Date
	steps: ClinicalSteps
}

// CAP-014-R14, CAP-015-R31, CAP-017-R02, CAP-017-R03, CAP-017-R04, CAP-017-R16
export function summaryViewOf(source: SummarySource, nameOf: LocalizedNameOf, texts: Texts): SummaryView {
	const { draft, codeLists } = source
	return {
		visit: visitMomentOf(visitWhenOf(draft.encounter, source.openedAt, texts.language), texts),
		wound:
			draft.body_site === undefined
				? undefined
				: woundPlaceOf(draft.body_site, codeLists.body_diagram.regions, nameOf, texts),
		assessment: summaryAssessmentOf(source, nameOf, texts),
		note: draft.assessment?.description,
	}
}

// CAP-021-R32
export function latestDraftOf(known: AcquisitionDraft | undefined, loaded: AcquisitionDraft): AcquisitionDraft {
	return known !== undefined && known.acquisition_id === loaded.acquisition_id && known.version > loaded.version
		? known
		: loaded
}

// CAP-017-R16
function summaryAssessmentOf(
	{ draft, codeLists, steps }: SummarySource,
	nameOf: LocalizedNameOf,
	texts: Texts,
): SummaryAssessment | undefined {
	const eyebrow = assessmentEyebrowOf(steps, texts.capture.summary.typeAndPhase, texts)
	if (eyebrow === undefined) {
		return undefined
	}
	const type = codeNameOf(codeLists.wound_types, draft.wound_type_code, nameOf)
	const phase = codeNameOf(codeLists.healing_phases, draft.assessment?.healing_phase_code, nameOf)
	const isComplete = (!steps.woundType || type !== undefined) && (!steps.healingPhase || phase !== undefined)
	return { eyebrow, value: isComplete ? typeAndPhaseOf(type, phase, steps, texts) : undefined }
}
