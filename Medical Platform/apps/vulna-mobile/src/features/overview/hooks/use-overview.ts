import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { encounterApi, type ScheduledEncounterItem, type UnfinishedEncounterItem } from "../../../api/encounters"
import { patientApi, type RecentPatientItem } from "../../../api/patients"
import { deviceDateOf } from "../../../utils/format-date"
import { readOwnDrafts } from "../../drafts/own-drafts"
import { type LoadState, useRemoteContent } from "../../remote/hooks/use-remote-content"
import { effectiveConfiguration } from "../../session/effective-configuration-store"
import { sessionCaller } from "../../session/session-actions"
import { useReloadAfterClosure } from "../../upload/hooks/use-reload-after-closure"
import { type ClinicalSection, readClinicalSection } from "../clinical-section"

export interface OverviewContent {
	drafts: readonly AcquisitionDraftSummary[]
	// clinical-workflow.yaml listUnfinishedEncounters
	unfinished: ClinicalSection<UnfinishedEncounterItem>
	// CAP-014-R16
	scheduled: readonly ScheduledEncounterItem[] | undefined
	// clinical-workflow.yaml listRecentPatients
	recent: ClinicalSection<RecentPatientItem> | undefined
}

export type OverviewState = LoadState<OverviewContent>

// CAP-015-R29, CAP-014-R16, CAP-014-R18, CAP-002-R17, CAP-019-R28, clinical-workflow.yaml listRecentPatients
export function useOverview() {
	const { state, retry, reload } = useRemoteContent(readOverviewContent)
	useReloadAfterClosure(reload)
	return { state, retry }
}

// CAP-015-R29
export function homeDraftRows(): number | undefined {
	return effectiveConfiguration()?.home_draft_acquisitions_max_rows
}

export function isScheduledSectionOn(): boolean {
	return effectiveConfiguration()?.scheduled_encounters_enabled === true
}

async function readOverviewContent(): Promise<OverviewContent> {
	return await sessionCaller.call(readOverview)
}

async function readOverview(sessionToken: string): Promise<OverviewContent> {
	const isScheduledOn = isScheduledSectionOn()
	const [drafts, unfinished, scheduled, recent] = await Promise.all([
		readOwnDrafts(sessionToken),
		readClinicalSection(async () => (await encounterApi.listUnfinishedEncounters(sessionToken)).items),
		isScheduledOn
			? encounterApi.listScheduledEncounters(sessionToken, deviceDateOf(new Date())).then((list) => list.items)
			: undefined,
		isScheduledOn
			? undefined
			: readClinicalSection(async () => (await patientApi.listRecentPatients(sessionToken)).items),
	])
	return { drafts, unfinished, scheduled, recent }
}
