import { ACQUISITION_KIND } from "@ansora/contracts"
import { calendarDayIn, INSTANCE_TIME_ZONE } from "@ansora/vulna-domain"
import { bodySiteIn } from "./body-site"
import { demoId, studyInstanceUidOf } from "./demo-id"
import type {
	DemoDocument,
	DemoPatient,
	DemoPlan,
	DemoRecord,
	DemoWound,
	PlannedAcquisition,
	PlannedFile,
} from "./demo-types"
import { ASSET_KIND, type AssetKind } from "./files"

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const RECORD_MINUTES = 3
const FINDING_MINUTES_BEFORE_CLOSING = 2
const UPLOAD_SECONDS = 20
const FIRST_SEQUENCE = 1

function minutesBefore(moment: Date, minutes: number): Date {
	return new Date(moment.getTime() - minutes * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND)
}

function secondsAfter(moment: Date, seconds: number): Date {
	return new Date(moment.getTime() + seconds * MILLISECONDS_PER_SECOND)
}

function emptyPlan(): DemoPlan {
	return {
		encounters: [],
		acquisitions: [],
		findings: [],
		changes: [],
		sites: [],
		assessments: [],
		images: [],
		documents: [],
		pages: [],
	}
}

function filesOf(
	acquisitionKey: string,
	acquisitionId: string,
	startedAt: Date,
	kind: AssetKind,
	names: readonly string[],
): PlannedFile[] {
	return names.map(
		(name, index): PlannedFile => ({
			id: demoId(`${acquisitionKey}/file/${index}`),
			acquisition_id: acquisitionId,
			file_key: demoId(`${acquisitionKey}/file/${index}/key`),
			sequence: index + FIRST_SEQUENCE,
			asset_kind: kind,
			asset_name: name,
			received_at: secondsAfter(startedAt, (index + FIRST_SEQUENCE) * UPLOAD_SECONDS),
		}),
	)
}

function encounterIdOf(patient: DemoPatient, visitKey: string): string {
	if (!patient.visits.some((visit) => visit.key === visitKey)) {
		throw new Error(`The demo record of ${patient.key} names the unknown visit ${visitKey}`)
	}
	return demoId(`${patient.key}/visit/${visitKey}`)
}

function acquisitionOf(
	patient: DemoPatient,
	patientId: string,
	key: string,
	visitKey: string,
	closedAt: Date,
	fileCount: number,
): PlannedAcquisition {
	return {
		id: demoId(key),
		idempotency_key: demoId(`${key}/idempotency`),
		patient_id: patientId,
		encounter_id: encounterIdOf(patient, visitKey),
		finding_id: null,
		kind: ACQUISITION_KIND.PHOTO,
		started_at: minutesBefore(closedAt, RECORD_MINUTES),
		closed_at: closedAt,
		file_count: fileCount,
		closed_wound_type_code: null,
	}
}

// CAP-020-R19, ADR-006
function closedWoundTypeOf(wound: DemoWound, closedAt: Date): string {
	if (wound.change !== undefined && closedAt.getTime() < Date.parse(wound.change.changedAt)) {
		return wound.change.from
	}
	return wound.woundType
}

// CAP-020-R13, CAP-020-R19, CAP-016-R17
function addWound(plan: DemoPlan, patient: DemoPatient, patientId: string, wound: DemoWound): void {
	const findingId = demoId(`${patient.key}/wound/${wound.key}`)
	const site = bodySiteIn(wound.regionCode, wound.view, wound.laterality)
	const records = [...wound.records].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt))
	const first = records.at(0)
	if (first === undefined) {
		throw new Error(`The demo wound ${wound.key} of ${patient.key} has no closed record`)
	}
	// CAP-020-R21
	if (wound.change !== undefined && Date.parse(wound.change.changedAt) <= Date.parse(first.closedAt)) {
		throw new Error(
			`The demo wound ${wound.key} of ${patient.key} changes its type at ${wound.change.changedAt}, not after its first closed record at ${first.closedAt}`,
		)
	}
	records.forEach((record: DemoRecord, index) => {
		const key = `${patient.key}/wound/${wound.key}/record/${index}`
		const acquisition = acquisitionOf(
			patient,
			patientId,
			key,
			record.visit,
			new Date(record.closedAt),
			record.photos.length,
		)
		plan.acquisitions.push({
			...acquisition,
			finding_id: findingId,
			closed_wound_type_code: closedWoundTypeOf(wound, acquisition.closed_at),
		})
		plan.sites.push({
			acquisition_id: acquisition.id,
			region_code: site.regionCode,
			laterality: site.laterality,
			view: site.view,
			x: site.x,
			y: site.y,
			body_diagram_version: site.bodyDiagramVersion,
		})
		plan.assessments.push({
			acquisition_id: acquisition.id,
			healing_phase_code: record.healingPhase,
			description: record.note ?? null,
			updated_at: acquisition.closed_at,
		})
		plan.images.push(...filesOf(key, acquisition.id, acquisition.started_at, ASSET_KIND.WOUND, record.photos))
	})
	if (wound.change !== undefined && wound.change.to !== wound.woundType) {
		throw new Error(`The demo wound ${wound.key} changes to ${wound.change.to}, not to its type ${wound.woundType}`)
	}
	plan.findings.push({
		id: findingId,
		patient_id: patientId,
		finding_key: demoId(`${patient.key}/wound/${wound.key}/key`),
		origin_acquisition_id: demoId(`${patient.key}/wound/${wound.key}/record/0`),
		created_at: minutesBefore(new Date(first.closedAt), FINDING_MINUTES_BEFORE_CLOSING),
		wound_type_code: wound.woundType,
	})
	if (wound.change !== undefined) {
		plan.changes.push({
			id: demoId(`${patient.key}/wound/${wound.key}/change`),
			finding_id: findingId,
			changed_at: new Date(wound.change.changedAt),
			previous_wound_type_code: wound.change.from,
			wound_type_code: wound.change.to,
		})
	}
}

// CAP-018-R11, CAP-018-R15
function addDocument(plan: DemoPlan, patient: DemoPatient, patientId: string, document: DemoDocument): void {
	const key = `${patient.key}/document/${document.key}`
	const acquisition = acquisitionOf(
		patient,
		patientId,
		key,
		document.visit,
		new Date(document.closedAt),
		document.pages.length,
	)
	plan.acquisitions.push({ ...acquisition, kind: ACQUISITION_KIND.SCAN })
	plan.documents.push({ id: demoId(`${key}/document`), acquisition_id: acquisition.id, title: document.title })
	plan.pages.push(...filesOf(key, acquisition.id, acquisition.started_at, ASSET_KIND.PAGE, document.pages))
}

// CAP-014-R03, CAP-014-R20
export function planOf(patient: DemoPatient, patientId: string): DemoPlan {
	const plan = emptyPlan()
	for (const visit of patient.visits) {
		const id = demoId(`${patient.key}/visit/${visit.key}`)
		const startedAt = new Date(visit.startedAt)
		plan.encounters.push({
			id,
			patient_id: patientId,
			date: calendarDayIn(INSTANCE_TIME_ZONE, startedAt),
			started_at: startedAt,
			completed_at: new Date(visit.completedAt),
			encounter_key: demoId(`${patient.key}/visit/${visit.key}/key`),
			study_instance_uid: studyInstanceUidOf(id),
		})
	}
	for (const wound of patient.wounds) {
		addWound(plan, patient, patientId, wound)
	}
	for (const document of patient.documents) {
		addDocument(plan, patient, patientId, document)
	}
	return plan
}

export function mergedPlan(plans: readonly DemoPlan[]): DemoPlan {
	return {
		encounters: plans.flatMap((plan) => plan.encounters),
		acquisitions: plans.flatMap((plan) => plan.acquisitions),
		findings: plans.flatMap((plan) => plan.findings),
		changes: plans.flatMap((plan) => plan.changes),
		sites: plans.flatMap((plan) => plan.sites),
		assessments: plans.flatMap((plan) => plan.assessments),
		images: plans.flatMap((plan) => plan.images),
		documents: plans.flatMap((plan) => plan.documents),
		pages: plans.flatMap((plan) => plan.pages),
	}
}
