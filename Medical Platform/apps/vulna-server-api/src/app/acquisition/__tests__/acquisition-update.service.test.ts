import { ACQUISITION_KIND, ERROR_CODE } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { ACQUISITION_STATE, type BodySite } from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ViewerService } from "../../clinical-record/services/viewer.service"
import {
	acquisitionRow,
	CURRENT,
	DEPARTMENT,
	ENCOUNTER,
	fakeDatabase,
	foundPatient,
	NOW,
	OTHER_PATIENT,
	OTHER_USER,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import { WoundTypeLockedError } from "../../finding/errors/wound-type-locked.error"
import type { DraftAssessmentService } from "../../finding/services/draft-assessment.service"
import type { FindingLocationService } from "../../finding/services/finding-location.service"
import type { FindingWoundTypeService } from "../../finding/services/finding-wound-type.service"
import type {
	AssessmentChoice,
	AssessmentRequest,
	LocatedDraft,
	WoundTypeChoice,
	WoundTypeRequest,
} from "../../finding/types/finding.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { PatientRepository } from "../../registry/repositories/patient.repository"
import { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { AcquisitionDraftUpdateInput, DocumentTitleInput } from "../dto/acquisition-draft-update.input.dto"
import type { AcquisitionDraftRepository } from "../repositories/acquisition-draft.repository"
import type { AcquisitionUpdateRequestRepository } from "../repositories/acquisition-update-request.repository"
import type { DocumentRepository } from "../repositories/document.repository"
import type { AcquisitionDraftViewService } from "../services/acquisition-draft-view.service"
import { AcquisitionUpdateService } from "../services/acquisition-update.service"
import type { DocumentTitleService } from "../services/document-title.service"
import type {
	AcquisitionDraftView,
	AcquisitionRow,
	AcquisitionUpdateRequestRow,
	NewUpdateRequest,
} from "../types/acquisition.types"
import type { DocumentTitleChoice } from "../types/acquisition-file.types"
import { requestFingerprintOf } from "../utils/request-fingerprint"

const VERSION = 4
const REQUEST_KEY = "f1000000-0000-4000-8000-000000000001"
const NEXT_REQUEST_KEY = "f1000000-0000-4000-8000-000000000002"
const FINDING_KEY = "f2000000-0000-4000-8000-000000000001"
const NEW_FINDING = "f3000000-0000-4000-8000-000000000001"
const EXISTING_FINDING = "f4000000-0000-4000-8000-000000000001"
const SET_VERSION = 3
const SACRUM = {
	region_code: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 0.4625,
	body_diagram_version: "1",
} as const
const PLACE_NEW: AcquisitionDraftUpdateInput = { finding_key: FINDING_KEY, body_site: SACRUM }
const WOUND_TYPE: AcquisitionDraftUpdateInput = { wound_type_code: "leg-ulcer", code_list_version: "3" }
const PHASE: AcquisitionDraftUpdateInput = { assessment: { healing_phase_code: "granulating", code_list_version: "3" } }

interface Setup {
	draft: AcquisitionRow
	lockedDraft: AcquisitionRow | undefined
	requests: Map<string, AcquisitionUpdateRequestRow>
	woundTypeLocked: boolean
	woundTypeOffered: boolean
}

function choiceOf(request: WoundTypeRequest): WoundTypeChoice {
	return { code: request.code, codeListVersion: SET_VERSION, setBy: request.userId }
}

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		draft: acquisitionRow({ version: VERSION }),
		lockedDraft: undefined,
		requests: new Map(),
		woundTypeLocked: false,
		woundTypeOffered: true,
		...setup,
	}
	const steps: string[] = []
	const audits: NewAuditEvent[] = []
	const stored: NewUpdateRequest[] = []
	const placed: { key: string; site: BodySite; createdBy: string }[] = []
	const lockedDraftOf = () => state.lockedDraft ?? state.draft
	const drafts = {
		findById: async () => state.draft,
		lockById: async () => lockedDraftOf(),
		touch: async (_tx: never, id: string, findingId: string | null) => {
			steps.push(`touch:${findingId}`)
			const row = { ...lockedDraftOf(), id, finding_id: findingId, version: lockedDraftOf().version + 1 }
			state.lockedDraft = row
			return row
		},
	} as unknown as AcquisitionDraftRepository
	const requests = {
		findByKey: async (_tx: never, _id: string, key: string) => state.requests.get(key),
		insert: async (_tx: never, request: NewUpdateRequest) => {
			stored.push(request)
			state.requests.set(request.requestKey, { body_sha256: request.fingerprint, response: request.response })
		},
	} as unknown as AcquisitionUpdateRequestRepository
	const locations = {
		checkExisting: async (_tx: never, _draft: LocatedDraft, findingId: string) => {
			steps.push(`check existing:${findingId}`)
			return { finding: { id: findingId }, closedSite: undefined }
		},
		chooseExisting: async (_tx: never, _draft: LocatedDraft, findingId: string) => {
			steps.push(`choose existing:${findingId}`)
			return findingId
		},
		placeNew: async (_tx: never, _draft: LocatedDraft, key: string, site: BodySite, createdBy: string) => {
			steps.push("place new")
			placed.push({ key, site, createdBy })
			return NEW_FINDING
		},
		moveNew: async (_tx: never, draft: LocatedDraft) => {
			steps.push("move new")
			return draft.finding_id
		},
		clear: async () => {
			steps.push("clear")
			return null
		},
	} as unknown as FindingLocationService
	const woundTypes = {
		check: async (_tx: never, existingFindingId: string | undefined, request: WoundTypeRequest) => {
			steps.push(`check wound type:${existingFindingId}`)
			if (!state.woundTypeOffered) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
			}
			if (state.woundTypeLocked) {
				throw new WoundTypeLockedError(EXISTING_FINDING, "pressure-ulcer", request.code, 1)
			}
			return choiceOf(request)
		},
		apply: async (_tx: never, _draft: LocatedDraft, findingId: string, choice: WoundTypeChoice) => {
			steps.push(`apply wound type:${findingId}:${choice.code}`)
		},
	} as unknown as FindingWoundTypeService
	const assessments = {
		check: async (_tx: never, request: AssessmentRequest): Promise<AssessmentChoice> => {
			steps.push("check assessment")
			return { ...request, codeListVersion: SET_VERSION }
		},
		apply: async (_tx: never, _draft: LocatedDraft, findingId: string, choice: AssessmentChoice) => {
			steps.push(`apply assessment:${findingId}:${choice.healingPhaseCode}:${choice.description}`)
		},
		withdraw: async () => {
			steps.push("withdraw assessment")
		},
		followFinding: async (_tx: never, _draft: LocatedDraft, findingId: string) => {
			steps.push(`follow assessment:${findingId}`)
		},
	} as unknown as DraftAssessmentService
	const views = {
		viewOf: async (_sql: never, row: AcquisitionRow) => ({
			acquisition_id: row.id,
			finding_id: row.finding_id,
			version: row.version,
		}),
	} as unknown as AcquisitionDraftViewService
	const viewers = { viewerOf: async () => ({ userId: USER, departmentId: DEPARTMENT }) } as unknown as ViewerService
	const patients = {
		byIds: async (ids: readonly string[]) => ids.map((id) => foundPatient(id)),
	} as unknown as PatientRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const appliedTitles: DocumentTitleChoice[] = []
	const titles = {
		check: async (_tx: never, title: DocumentTitleInput): Promise<DocumentTitleChoice> => {
			steps.push("check document title")
			return {
				code: title.code ?? null,
				text: title.text ?? null,
				codeListVersion: title.code === undefined ? null : SET_VERSION,
			}
		},
	} as unknown as DocumentTitleService
	const documents = {
		setTitle: async (_tx: never, _acquisitionId: string, title: DocumentTitleChoice) => {
			appliedTitles.push(title)
		},
	} as unknown as DocumentRepository
	const service = new AcquisitionUpdateService(
		fakeDatabase(),
		drafts,
		requests,
		locations,
		woundTypes,
		assessments,
		views,
		viewers,
		new PatientLookupService(patients),
		audit,
		titles,
		documents,
	)
	return { service, audits, stored, placed, steps, appliedTitles }
}

function updateOf(input: AcquisitionDraftUpdateInput, version = VERSION, requestKey = REQUEST_KEY) {
	return { acquisitionId: acquisitionRow().id, version, requestKey, input }
}

function knownRequest(
	input: AcquisitionDraftUpdateInput,
	response: AcquisitionDraftView | null,
): Map<string, AcquisitionUpdateRequestRow> {
	return new Map([[REQUEST_KEY, { body_sha256: requestFingerprintOf(input), response }]])
}

describe("draft record completed at the bedside CAP-015-R30", () => {
	it("CAP-016-S01 places the new finding, raises the version and audits the update without content", async () => {
		const run = harness()

		const view = await run.service.update(CURRENT, updateOf(PLACE_NEW), NOW)

		expect(view).toMatchObject({ finding_id: NEW_FINDING, version: VERSION + 1 })
		expect(run.placed).toEqual([
			{
				key: FINDING_KEY,
				site: {
					regionCode: "51027004",
					laterality: null,
					view: "posterior",
					x: 0.5,
					y: 0.4625,
					bodyDiagramVersion: "1",
				},
				createdBy: USER,
			},
		])
		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED,
			outcome: AUDIT_OUTCOME.SUCCESS,
			details: { encounter_id: ENCOUNTER, acquisition_id: acquisitionRow().id, operator_user_id: USER },
		})
		expect(JSON.stringify(run.audits[0]?.details)).not.toContain("51027004")
	})

	it("CAP-021-S24 keeps the request key with the answer it gave", async () => {
		const run = harness()

		const view = await run.service.update(CURRENT, updateOf(PLACE_NEW), NOW)

		expect(run.stored).toEqual([
			{
				acquisitionId: acquisitionRow().id,
				requestKey: REQUEST_KEY,
				fingerprint: requestFingerprintOf(PLACE_NEW),
				response: view,
			},
		])
	})

	it("CAP-021-S24 answers a repeated update with the original answer and changes nothing", async () => {
		const original = { acquisition_id: acquisitionRow().id, version: VERSION } as AcquisitionDraftView
		const run = harness({
			draft: acquisitionRow({ version: VERSION + 3 }),
			requests: knownRequest(PLACE_NEW, original),
		})

		const view = await run.service.update(CURRENT, updateOf(PLACE_NEW, VERSION - 1), NOW)

		expect(view).toBe(original)
		expect(run.steps).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-021-S24 answers a repeated update kept without its answer with the record as it is", async () => {
		const run = harness({ requests: knownRequest(PLACE_NEW, null) })

		const view = await run.service.update(CURRENT, updateOf(PLACE_NEW, VERSION - 1), NOW)

		expect(view).toMatchObject({ version: VERSION })
		expect(run.steps).toEqual([])
		expect(run.audits).toEqual([])
	})

	it("CAP-021-S23 applies a second update with a new request key", async () => {
		const run = harness()
		await run.service.update(CURRENT, updateOf(PLACE_NEW), NOW)

		const second = await run.service.update(CURRENT, updateOf(PHASE, VERSION + 1, NEXT_REQUEST_KEY), NOW)

		expect(second).toMatchObject({ version: VERSION + 2 })
		expect(run.stored.map((request) => request.requestKey)).toEqual([REQUEST_KEY, NEXT_REQUEST_KEY])
		expect(run.audits).toHaveLength(2)
	})

	it("CAP-021-S24 CAP-021-R29 refuses the same request key with other content", async () => {
		const run = harness({ requests: knownRequest({ finding_id: null }, null) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.IDEMPOTENCY_CONFLICT)
		expect(run.steps).toEqual([])
	})

	it("CAP-021-R32 refuses an update of another version", async () => {
		const run = harness()

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW, VERSION - 1), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
		expect(run.steps).toEqual([])
	})

	it("CAP-021-R32 refuses an update of a draft moved to another patient meanwhile", async () => {
		const run = harness({ lockedDraft: acquisitionRow({ version: VERSION, patient_id: OTHER_PATIENT }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_VERSION_CONFLICT)
		expect(run.steps).toEqual([])
	})

	it("CAP-014-R07 refuses a closed record", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, state: ACQUISITION_STATE.RECEIVED }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW), NOW))

		expect(problem.code).toBe(ERROR_CODE.ACQUISITION_CLOSED)
	})

	it("CAP-015-R17 hides the record of another clinician", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, operator_user_id: OTHER_USER }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
	})

	it("CAP-018-R14 refuses a body site on a scanned document", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PLACE_NEW), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the assessment before the finding is cleared", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }) })

		await run.service.update(CURRENT, updateOf({ finding_id: null }), NOW)

		expect(run.steps).toEqual(["withdraw assessment", "clear", "touch:null"])
	})
})

describe("finding chosen or moved on the body diagram CAP-016-R17", () => {
	it("CAP-016-S10 attaches an existing finding and records the assessment on it again", async () => {
		const run = harness()

		const view = await run.service.update(CURRENT, updateOf({ finding_id: EXISTING_FINDING }), NOW)

		expect(view).toMatchObject({ finding_id: EXISTING_FINDING })
		expect(run.steps).toEqual([
			`choose existing:${EXISTING_FINDING}`,
			`follow assessment:${EXISTING_FINDING}`,
			`touch:${EXISTING_FINDING}`,
		])
	})

	it("CAP-016-S06 moves the new finding of the draft to another place", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }) })

		await run.service.update(CURRENT, updateOf({ body_site: SACRUM }), NOW)

		expect(run.steps).toEqual(["move new", `follow assessment:${NEW_FINDING}`, `touch:${NEW_FINDING}`])
	})

	it("CAP-017-R02 checks the wound type against the existing finding before anything is written", async () => {
		const run = harness()

		await run.service.update(CURRENT, updateOf({ finding_id: EXISTING_FINDING, ...WOUND_TYPE }), NOW)

		expect(run.steps).toEqual([
			`check existing:${EXISTING_FINDING}`,
			`check wound type:${EXISTING_FINDING}`,
			`choose existing:${EXISTING_FINDING}`,
			`follow assessment:${EXISTING_FINDING}`,
			`apply wound type:${EXISTING_FINDING}:leg-ulcer`,
			`touch:${EXISTING_FINDING}`,
		])
	})

	it("CAP-020-R13 checks the wound type of a moved new finding as a finding the draft founded", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }) })

		await run.service.update(CURRENT, updateOf({ body_site: SACRUM, ...WOUND_TYPE }), NOW)

		expect(run.steps.slice(0, 2)).toEqual(["check wound type:undefined", "move new"])
	})
})

describe("wound type and healing phase chosen with one tap CAP-017-R19", () => {
	it("CAP-017-S01 checks both choices, places the finding and only then writes them on it", async () => {
		const run = harness()

		await run.service.update(
			CURRENT,
			updateOf({
				...PLACE_NEW,
				...WOUND_TYPE,
				assessment: { healing_phase_code: "granulating", code_list_version: "3", description: "Klidné okraje" },
			}),
			NOW,
		)

		expect(run.steps).toEqual([
			"check wound type:undefined",
			"check assessment",
			"place new",
			`apply wound type:${NEW_FINDING}:leg-ulcer`,
			`apply assessment:${NEW_FINDING}:granulating:Klidné okraje`,
			`touch:${NEW_FINDING}`,
		])
		expect(run.audits.map((event) => event.eventType)).toEqual([AUDIT_EVENT_TYPE.DRAFT_ACQUISITION_UPDATED])
		expect(JSON.stringify(run.audits[0]?.details)).not.toContain("Klidné")
	})

	it("CAP-017-R02 checks the wound type of the finding the draft already has", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }) })

		await run.service.update(CURRENT, updateOf(WOUND_TYPE), NOW)

		expect(run.steps).toEqual([
			`check wound type:${NEW_FINDING}`,
			`apply wound type:${NEW_FINDING}:leg-ulcer`,
			`touch:${NEW_FINDING}`,
		])
	})

	it("CAP-017-R16 refuses a wound type the code list does not offer before the new finding is founded", async () => {
		const run = harness({ woundTypeOffered: false })

		const problem = await problemOf(run.service.update(CURRENT, updateOf({ ...PLACE_NEW, ...WOUND_TYPE }), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.placed).toEqual([])
		expect(run.steps).toEqual(["check wound type:undefined"])
		expect(run.stored).toEqual([])
	})

	it("CAP-017-S14 refuses another wound type of a finding with a closed record and audits the attempt", async () => {
		const run = harness({
			draft: acquisitionRow({ version: VERSION, finding_id: EXISTING_FINDING }),
			woundTypeLocked: true,
		})

		const problem = await problemOf(run.service.update(CURRENT, updateOf(WOUND_TYPE), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.CONFLICT)
		expect(problem.code).toBe(ERROR_CODE.WOUND_TYPE_LOCKED)
		expect(run.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.FINDING_WOUND_TYPE_CHANGED,
				outcome: AUDIT_OUTCOME.REJECTED,
				objectId: EXISTING_FINDING,
				details: {
					patient_identifier: foundPatient(PATIENT).identifiers[0]?.value,
					acquisition_id: acquisitionRow().id,
					reason: ERROR_CODE.WOUND_TYPE_LOCKED,
					wound_type_change: {
						finding_id: EXISTING_FINDING,
						previous_wound_type_code: "pressure-ulcer",
						wound_type_code: "leg-ulcer",
						code_list_version: "1",
					},
				},
			}),
		])
		expect(run.steps).toEqual([`check wound type:${EXISTING_FINDING}`])
	})

	it("CAP-017-S14 refuses a locked wound type of a chosen finding before the draft's own finding is withdrawn", async () => {
		const run = harness({
			draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }),
			woundTypeLocked: true,
		})

		const problem = await problemOf(
			run.service.update(CURRENT, updateOf({ finding_id: EXISTING_FINDING, ...WOUND_TYPE }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.WOUND_TYPE_LOCKED)
		expect(run.steps).toEqual([`check existing:${EXISTING_FINDING}`, `check wound type:${EXISTING_FINDING}`])
	})

	it("CAP-017-R02 refuses a wound type on a finding cleared by the same request without writing anything", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, finding_id: NEW_FINDING }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf({ finding_id: null, ...WOUND_TYPE }), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.steps).toEqual([])
	})

	it("CAP-017-R03 refuses a healing phase for a record without a finding", async () => {
		const run = harness()

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PHASE), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.steps).toEqual([])
	})

	it("CAP-018-R14 refuses a healing phase on a scanned document", async () => {
		const run = harness({ draft: acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN }) })

		const problem = await problemOf(run.service.update(CURRENT, updateOf(PHASE), NOW))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})
})

describe("document title chosen before the summary CAP-018-R15", () => {
	const SCAN = acquisitionRow({ version: VERSION, kind: ACQUISITION_KIND.SCAN })

	it("stores a title chosen from the code list on the document and raises the version", async () => {
		const run = harness({ draft: SCAN })

		const view = await run.service.update(
			CURRENT,
			updateOf({ document_title: { code: "discharge-report", code_list_version: "3" } }),
			NOW,
		)

		expect(view).toMatchObject({ version: VERSION + 1 })
		expect(run.appliedTitles).toEqual([{ code: "discharge-report", text: null, codeListVersion: SET_VERSION }])
		expect(run.audits).toHaveLength(1)
	})

	it("stores an own title as text", async () => {
		const run = harness({ draft: SCAN })

		await run.service.update(CURRENT, updateOf({ document_title: { text: "Nález z ortopedie" } }), NOW)

		expect(run.appliedTitles).toEqual([{ code: null, text: "Nález z ortopedie", codeListVersion: null }])
	})

	it("CAP-018-R14 refuses a document title on a wound record", async () => {
		const run = harness()

		const problem = await problemOf(
			run.service.update(CURRENT, updateOf({ document_title: { text: "Nález z ortopedie" } }), NOW),
		)

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(run.appliedTitles).toEqual([])
	})
})
