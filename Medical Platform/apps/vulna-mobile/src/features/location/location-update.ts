import type { BodyDiagramDrawing } from "@ansora/contracts"
import type { AcquisitionDraft, AcquisitionDraftUpdate } from "../../api/acquisitions"
import type { BodySite } from "../../api/findings"
import { type CaptureSession, WOUND_CHOICE, type WoundChoice } from "../capture/capture-session"
import type { LocatedFinding } from "./wound-map-layout"

function isSameBodySite(first: BodySite, second: BodySite): boolean {
	return (
		first.region_code === second.region_code &&
		first.laterality === second.laterality &&
		first.view === second.view &&
		first.x === second.x &&
		first.y === second.y &&
		first.body_diagram_version === second.body_diagram_version
	)
}

// CAP-016-R17, CAP-015-R15
function trackedWoundOf(draft: AcquisitionDraft, wounds: readonly LocatedFinding[]): LocatedFinding | undefined {
	return wounds.find((wound) => wound.finding.finding_id === draft.finding_id)
}

// CAP-015-R15, CAP-016-R17
function choiceOfDraft(draft: AcquisitionDraft, wounds: readonly LocatedFinding[]): WoundChoice | undefined {
	if (draft.finding_id === null || draft.finding_id === undefined || draft.body_site === undefined) {
		return undefined
	}
	const tracked = trackedWoundOf(draft, wounds)
	if (tracked !== undefined) {
		return { kind: WOUND_CHOICE.EXISTING, finding: tracked.finding, bodySite: tracked.bodySite }
	}
	return { kind: WOUND_CHOICE.NEW, bodySite: draft.body_site, findingKey: undefined }
}

// CAP-015-R15, CAP-016-R17, CAP-016-R08
export function restoredChoiceOf(
	session: Pick<CaptureSession, "wound" | "isWoundCleared">,
	draft: AcquisitionDraft,
	wounds: readonly LocatedFinding[],
	drawing: BodyDiagramDrawing,
): WoundChoice | undefined {
	if (session.isWoundCleared) {
		return undefined
	}
	const choice = session.wound ?? choiceOfDraft(draft, wounds)
	if (choice === undefined || choice.bodySite.body_diagram_version !== drawing.version) {
		return undefined
	}
	return drawing.views[choice.bodySite.view] === undefined ? undefined : choice
}

// CAP-016-R17, CAP-015-R31, CAP-016-S06, clinical-workflow.yaml AcquisitionDraftUpdate
export function locationUpdateOf(
	choice: WoundChoice,
	draft: AcquisitionDraft,
	wounds: readonly LocatedFinding[],
): AcquisitionDraftUpdate | undefined {
	if (choice.kind === WOUND_CHOICE.EXISTING) {
		return draft.finding_id === choice.finding.finding_id ? undefined : { finding_id: choice.finding.finding_id }
	}
	const hasOwnNewFinding =
		draft.finding_id !== null && draft.finding_id !== undefined && trackedWoundOf(draft, wounds) === undefined
	const isSaved = hasOwnNewFinding && draft.body_site !== undefined && isSameBodySite(draft.body_site, choice.bodySite)
	if (isSaved) {
		return undefined
	}
	if (choice.findingKey === undefined) {
		throw new Error("a new wound is saved only with its finding key")
	}
	return { finding_key: choice.findingKey, body_site: choice.bodySite }
}

// CAP-021-R29
export async function keyedChoice(
	choice: WoundChoice | undefined,
	newKey: () => Promise<string>,
): Promise<WoundChoice | undefined> {
	if (choice?.kind !== WOUND_CHOICE.NEW || choice.findingKey !== undefined) {
		return choice
	}
	return { ...choice, findingKey: await newKey() }
}
