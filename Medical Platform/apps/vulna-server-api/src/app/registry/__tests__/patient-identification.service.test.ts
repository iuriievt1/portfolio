import { ERROR_CODE, PATIENT_IDENTIFICATION_METHOD, PATIENT_SEX, RETRY_AFTER_HEADER } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, AUDIT_OUTCOME, CONFIGURATION_KEY } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { CurrentSession } from "../../login/types/login.types"
import { RequestRateService } from "../../request-rate/services/request-rate.service"
import type { PatientIdentificationInput } from "../dto/patient-identification.input.dto"
import type { PatientRepository } from "../repositories/patient.repository"
import { PatientIdentificationService } from "../services/patient-identification.service"
import type { FoundPatient, PatientIdentifierRow } from "../types/registry.types"

const NOW = new Date("2026-10-06T08:00:00Z")
const RATE_LIMIT = 30
const SYSTEM = "urn:oid:2.25.1"
const TAG_SYSTEM = "urn:oid:2.25.2"
const BIRTH_NUMBER = "5603121234"
const OTHER_STRUCTURE = "RID-0042/7"

const CURRENT = {
	session: { id: "session-1", userId: "user-1", deviceId: "device-1" },
	token: "token",
	device: { id: "device-1" },
} as unknown as CurrentSession

function found(index: number, issuer: string | null = "MOU"): FoundPatient {
	return {
		patient: { id: `patient-${index}`, sex: PATIENT_SEX.MALE },
		identifiers: [{ patient_id: `patient-${index}`, system: SYSTEM, value: `${1000 + index}`, issuer }],
	}
}

function withValue(index: number, value: string): FoundPatient {
	return {
		patient: { id: `patient-${index}`, sex: null },
		identifiers: [{ patient_id: `patient-${index}`, system: SYSTEM, value, issuer: null }],
	}
}

interface HarnessOptions {
	limit?: number
	identified?: FoundPatient[][]
	isIdentifierFree?: boolean
	codeSystem?: string
}

function harnessWith(matches: FoundPatient[], options: HarnessOptions = {}) {
	const { limit = RATE_LIMIT, identified = [], isIdentifierFree = true, codeSystem = SYSTEM } = options
	const audits: NewAuditEvent[] = []
	const searched: { system: string; value: string }[] = []
	const searchedStarts: { system: string; start: string }[] = []
	const created: PatientIdentifierRow[] = []
	const repository = {
		byIdentifier: async (system: string, value: string) => {
			searched.push({ system, value })
			return identified.shift() ?? matches
		},
		byIdentifierStart: async (system: string, start: string) => {
			searchedStarts.push({ system, start })
			return matches
		},
		create: async (_tx: never, _identifierId: string, identifier: PatientIdentifierRow) => {
			created.push(identifier)
			return isIdentifierFree
		},
	} as unknown as PatientRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const configuredSystems = new Map<string, string>([
		[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, codeSystem],
		[CONFIGURATION_KEY.PATIENT_TAG_SYSTEM, TAG_SYSTEM],
	])
	const configuration = {
		integer: async () => limit,
		value: async (key: string) => configuredSystems.get(key) ?? null,
		values: async () => configuredSystems,
	} as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new PatientIdentificationService(database, repository, configuration, new RequestRateService(), audit)
	return { service, audits, searched, searchedStarts, created }
}

function readCode(value: string, system = SYSTEM): PatientIdentificationInput {
	return { search_method: PATIENT_IDENTIFICATION_METHOD.CODE, system, value }
}

describe("patient identified by the identifier on the wristband CHG-175 CAP-013-R10 CAP-013-R17", () => {
	it("CAP-013-S03 creates a patient known only by the identifier the index does not have and audits it", async () => {
		const harness = harnessWith([])

		const identification = await harness.service.identify(CURRENT, readCode(BIRTH_NUMBER), NOW)

		expect(identification.created).toBe(true)
		expect(harness.created).toEqual([
			{ patient_id: expect.any(String), system: SYSTEM, value: BIRTH_NUMBER, issuer: null },
		])
		expect(identification.found).toEqual([
			{
				patient: { id: harness.created[0]?.patient_id, sex: null },
				identifiers: harness.created,
			},
		])
		expect(harness.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				outcome: AUDIT_OUTCOME.CREATED,
				details: { search_method: "code", patient_identifier: BIRTH_NUMBER },
			}),
		])
	})

	it("CAP-013-R10 creates the patient from an identifier that is not a birth number", async () => {
		const harness = harnessWith([])

		const identification = await harness.service.identify(CURRENT, readCode(OTHER_STRUCTURE), NOW)

		expect(identification.created).toBe(true)
		expect(harness.created).toEqual([
			{ patient_id: expect.any(String), system: SYSTEM, value: OTHER_STRUCTURE, issuer: null },
		])
	})

	it("opens the patient the index already has and creates nothing", async () => {
		const harness = harnessWith([found(1)])

		const identification = await harness.service.identify(CURRENT, readCode("1001"), NOW)

		expect(identification).toEqual({ created: false, found: [found(1)] })
		expect(harness.created).toEqual([])
		expect(harness.audits.map((event) => event.outcome)).toEqual([AUDIT_OUTCOME.MATCH])
	})

	it("CAP-013-S20 CAP-025-S08 refuses an identifier system other than the configured one without searching or creating", async () => {
		const harness = harnessWith([])

		const problem = await problemOf(harness.service.identify(CURRENT, readCode(BIRTH_NUMBER, "urn:other"), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(harness.searched).toEqual([])
		expect(harness.created).toEqual([])
		expect(harness.audits.map((event) => event.outcome)).toEqual([AUDIT_OUTCOME.REJECTED])
		expect(JSON.stringify(harness.audits)).not.toContain(BIRTH_NUMBER)
	})

	it("CAP-013-R05 takes the identifier of an NFC tag in the system configured for tags", async () => {
		const harness = harnessWith([])

		const identification = await harness.service.identify(
			CURRENT,
			{ search_method: PATIENT_IDENTIFICATION_METHOD.NFC_TAG, system: TAG_SYSTEM, value: BIRTH_NUMBER },
			NOW,
		)

		expect(identification.created).toBe(true)
		expect(harness.audits[0]?.details).toEqual({ search_method: "nfc_tag", patient_identifier: BIRTH_NUMBER })
	})

	it("CAP-024-R07 opens the patient another request created at the same moment instead of a second one", async () => {
		const harness = harnessWith([], { identified: [[], [found(1)]], isIdentifierFree: false })

		const identification = await harness.service.identify(CURRENT, readCode("1001"), NOW)

		expect(identification).toEqual({ created: false, found: [found(1)] })
		expect(harness.audits.map((event) => event.outcome)).toEqual([AUDIT_OUTCOME.MATCH])
	})

	it("CAP-013-S12 refuses the identification over the limit without searching, creates nothing and says when to retry", async () => {
		const harness = harnessWith([found(1)], { limit: 1 })
		await harness.service.identify(CURRENT, readCode("1001"), NOW)

		const problem = await problemOf(harness.service.identify(CURRENT, readCode(BIRTH_NUMBER), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
		expect(problem.code).toBe(ERROR_CODE.SEARCH_RATE_LIMITED)
		expect(problem.headers[RETRY_AFTER_HEADER]).toBe("60")
		expect(harness.searched).toHaveLength(1)
		expect(harness.created).toEqual([])
		expect(harness.audits.at(-1)?.outcome).toBe(AUDIT_OUTCOME.RATE_LIMITED)
	})

	it("CAP-013-S11 returns no patient and creates none when more than twenty match, and audits the refusal", async () => {
		const harness = harnessWith(Array.from({ length: 21 }, (_, index) => found(index, `issuer-${index}`)))

		const problem = await problemOf(harness.service.identify(CURRENT, readCode("1001"), NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.SEARCH_TOO_BROAD)
		expect(harness.created).toEqual([])
		expect(harness.audits).toEqual([
			expect.objectContaining({ outcome: AUDIT_OUTCOME.TOO_MANY_MATCHES, details: { search_method: "code" } }),
		])
	})

	it("returns twenty matches", async () => {
		const harness = harnessWith(Array.from({ length: 20 }, (_, index) => found(index, `issuer-${index}`)))

		const identification = await harness.service.identify(CURRENT, readCode("1001"), NOW)

		expect(identification.found).toHaveLength(20)
	})

	it("CAP-013-S19 returns the patients of every issuer of the read identifier and audits each of them", async () => {
		const harness = harnessWith([found(1, "MOU"), found(2, "FN")])

		const identification = await harness.service.identify(CURRENT, readCode("1001"), NOW)

		expect(harness.searched).toEqual([{ system: SYSTEM, value: "1001" }])
		expect(identification.found.map((patient) => patient.identifiers[0]?.issuer)).toEqual(["MOU", "FN"])
		expect(harness.audits[0]?.details).toEqual({ search_method: "code", patient_identifiers: ["1001", "1002"] })
	})

	it("CAP-025-S17 audits the identified patient with the way of reading and the outcome", async () => {
		const harness = harnessWith([found(1)])

		await harness.service.identify(CURRENT, readCode("1001"), NOW)

		expect(harness.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				actorUserId: "user-1",
				actorDeviceId: "device-1",
				sessionId: "session-1",
				outcome: AUDIT_OUTCOME.MATCH,
				details: { search_method: "code", patient_identifier: "1001" },
			}),
		])
	})
})

describe("patient searched by the beginning of the identifier CHG-182 CAP-013-R07 CAP-013-R17", () => {
	it("CAP-013-S22 lists the patients whose identifier in the code system begins with the query and audits them without it", async () => {
		const harness = harnessWith([withValue(1, "9910111234"), withValue(2, "9910115678")])

		const patients = await harness.service.find(CURRENT, { query: "991011" }, NOW)

		expect(patients).toEqual([withValue(1, "9910111234"), withValue(2, "9910115678")])
		expect(harness.searchedStarts).toEqual([{ system: SYSTEM, start: "991011" }])
		expect(harness.created).toEqual([])
		expect(harness.audits).toEqual([
			expect.objectContaining({
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				outcome: AUDIT_OUTCOME.MATCH,
				details: { search_method: "identifier_search", patient_identifiers: ["9910111234", "9910115678"] },
			}),
		])
	})

	it("searches without the spaces and slashes of a written birth number", async () => {
		const harness = harnessWith([withValue(1, "9910111234")])

		await harness.service.find(CURRENT, { query: " 991011 / 12 " }, NOW)

		expect(harness.searchedStarts).toEqual([{ system: SYSTEM, start: "99101112" }])
	})

	it("CAP-013-S23 refuses fewer than 3 characters without searching and audits the refusal", async () => {
		const harness = harnessWith([withValue(1, "9910111234")])

		const problem = await problemOf(harness.service.find(CURRENT, { query: "9 / 9" }, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
		expect(problem.code).toBe(ERROR_CODE.SEARCH_QUERY_TOO_SHORT)
		expect(harness.searchedStarts).toEqual([])
		expect(harness.audits).toEqual([
			expect.objectContaining({
				outcome: AUDIT_OUTCOME.QUERY_TOO_SHORT,
				details: { search_method: "identifier_search" },
			}),
		])
	})

	it("CAP-013-S24 creates nobody when nothing matches and audits the search without the query", async () => {
		const harness = harnessWith([])

		const patients = await harness.service.find(CURRENT, { query: "8812" }, NOW)

		expect(patients).toEqual([])
		expect(harness.searched).toEqual([])
		expect(harness.created).toEqual([])
		expect(harness.audits).toEqual([
			expect.objectContaining({ outcome: AUDIT_OUTCOME.NO_MATCH, details: { search_method: "identifier_search" } }),
		])
		expect(JSON.stringify(harness.audits)).not.toContain("8812")
	})

	it("CAP-013-S25 returns no patient when more than twenty match and audits the refusal", async () => {
		const harness = harnessWith(Array.from({ length: 21 }, (_, index) => withValue(index, `995${index}`)))

		const problem = await problemOf(harness.service.find(CURRENT, { query: "995" }, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
		expect(problem.code).toBe(ERROR_CODE.SEARCH_TOO_BROAD)
		expect(harness.audits).toEqual([
			expect.objectContaining({
				outcome: AUDIT_OUTCOME.TOO_MANY_MATCHES,
				details: { search_method: "identifier_search" },
			}),
		])
	})

	it("CAP-013-S12 shares the limit of identifications per user and device", async () => {
		const harness = harnessWith([found(1)], { limit: 1 })
		await harness.service.identify(CURRENT, readCode("1001"), NOW)

		const problem = await problemOf(harness.service.find(CURRENT, { query: "991011" }, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS)
		expect(problem.code).toBe(ERROR_CODE.SEARCH_RATE_LIMITED)
		expect(harness.searchedStarts).toEqual([])
		expect(harness.audits.at(-1)?.outcome).toBe(AUDIT_OUTCOME.RATE_LIMITED)
	})

	it("CAP-013-R03 refuses the search when no identifier system is configured for the code", async () => {
		const harness = harnessWith([withValue(1, "9910111234")], { codeSystem: " " })

		const problem = await problemOf(harness.service.find(CURRENT, { query: "991011" }, NOW))

		expect(problem.getStatus()).toBe(HttpStatus.BAD_REQUEST)
		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
		expect(harness.searchedStarts).toEqual([])
		expect(harness.audits.map((event) => event.outcome)).toEqual([AUDIT_OUTCOME.REJECTED])
	})
})
