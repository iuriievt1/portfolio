import "reflect-metadata"
import {
	API_BASE_PATH,
	BEARER_PREFIX,
	CONTENT_TYPE_HEADER,
	ERROR_CODE,
	PATIENT_IDENTIFICATION_METHOD,
	ROLE,
} from "@ansora/contracts"
import { HttpStatus, Module, type Type } from "@nestjs/common"
import { NestFactory, Reflector } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { SERVER_TEXTS } from "../../../i18n"
import { DatabaseService } from "../../../libs/database/database.service"
import { DeviceProofService } from "../../device/services/device-proof.service"
import { DEVICE, foundPatient, SESSION, USER } from "../../encounter/__tests__/encounter-fixtures"
import { ProblemJsonFilter } from "../../infra/filters/problem-json.filter"
import { applyApiPrefix } from "../../infra/hosting/api-prefix"
import type { LocalizationService } from "../../localization/localization.service"
import { ClinicianRoleGuard } from "../../login/guards/clinician-role.guard"
import { UserSessionGuard } from "../../login/guards/user-session.guard"
import { SessionService } from "../../login/services/session.service"
import { UserIdentityService } from "../../login/services/user-identity.service"
import { PatientController } from "../controllers/patient.controller"
import type { PatientIdentificationInput } from "../dto/patient-identification.input.dto"
import type { PatientSearchInput } from "../dto/patient-search.input.dto"
import { PatientIdentificationService } from "../services/patient-identification.service"

const PATIENTS_PATH = `${API_BASE_PATH}/patients`
const IDENTIFICATION_PATH = `${PATIENTS_PATH}/identification`
const PARAMETER_TYPES = "design:paramtypes"
const JSON_TYPE = "application/json"
const SYSTEM = "urn:oid:2.25.1"
const BIRTH_NUMBER = "5603121234"
const PATIENT_ID_MAX_LENGTH = 64
const HOUR_MILLISECONDS = 3_600_000
const QUERY_MAX_LENGTH = 255

const calls = {
	identified: [] as PatientIdentificationInput[],
	searched: [] as PatientSearchInput[],
	isCreated: true,
}

function injects(target: Type<unknown>, dependencies: readonly Type<unknown>[]): void {
	Reflect.defineMetadata(PARAMETER_TYPES, dependencies, target)
}

injects(UserSessionGuard, [SessionService, DeviceProofService, Reflector])
injects(ClinicianRoleGuard, [DatabaseService, UserIdentityService])
injects(PatientController, [PatientIdentificationService])

@Module({
	controllers: [PatientController],
	providers: [
		UserSessionGuard,
		ClinicianRoleGuard,
		{
			provide: SessionService,
			useValue: {
				resolve: async () => ({
					id: SESSION,
					userId: USER,
					deviceId: DEVICE,
					tokenExpiresAt: new Date(Date.now() + HOUR_MILLISECONDS),
					startedAt: new Date(Date.now() - HOUR_MILLISECONDS),
					sessionEnd: new Date(Date.now() + HOUR_MILLISECONDS),
					endedAt: null,
				}),
			},
		},
		{ provide: DeviceProofService, useValue: { ofApprovedDevice: async () => ({ id: DEVICE }) } },
		{ provide: DatabaseService, useValue: {} },
		{ provide: UserIdentityService, useValue: { rolesOf: async () => [ROLE.CLINICIAN] } },
		{
			provide: PatientIdentificationService,
			useValue: {
				identify: async (_current: unknown, input: PatientIdentificationInput) => {
					calls.identified.push(input)
					return { created: calls.isCreated, found: [foundPatient()] }
				},
				find: async (_current: unknown, input: PatientSearchInput) => {
					calls.searched.push(input)
					return [foundPatient()]
				},
			},
		},
	],
})
class PatientHttpTestModule {}

let app: NestExpressApplication
let baseUrl: string

beforeAll(async () => {
	app = await NestFactory.create<NestExpressApplication>(PatientHttpTestModule, { logger: false })
	applyApiPrefix(app)
	const localization = {
		responseTexts: async () => ({ texts: SERVER_TEXTS.cs, contentLanguage: "cs" }),
	} as unknown as LocalizationService
	app.useGlobalFilters(new ProblemJsonFilter(localization))
	await app.listen(0)
	baseUrl = await app.getUrl()
})

afterAll(async () => {
	await app.close()
})

beforeEach(() => {
	calls.identified = []
	calls.searched = []
	calls.isCreated = true
})

async function identify(body: unknown): Promise<Response> {
	return await fetch(`${baseUrl}${IDENTIFICATION_PATH}`, {
		method: "POST",
		headers: { [CONTENT_TYPE_HEADER]: JSON_TYPE, authorization: `${BEARER_PREFIX}token` },
		body: JSON.stringify(body),
	})
}

async function search(query: string): Promise<Response> {
	return await fetch(`${baseUrl}${PATIENTS_PATH}?${query}`, { headers: { authorization: `${BEARER_PREFIX}token` } })
}

function codeRead(value: string): PatientIdentificationInput {
	return { search_method: PATIENT_IDENTIFICATION_METHOD.CODE, system: SYSTEM, value }
}

describe("identification of a patient by the wristband over HTTP CHG-175 CAP-013-R10", () => {
	it("CAP-013-S03 answers 201 with the patient the server created", async () => {
		const response = await identify(codeRead(BIRTH_NUMBER))

		expect(response.status).toBe(HttpStatus.CREATED)
		expect(((await response.json()) as { items: unknown[] }).items).toHaveLength(1)
		expect(calls.identified).toEqual([codeRead(BIRTH_NUMBER)])
	})

	it("answers 200 with the patient the index already had", async () => {
		calls.isCreated = false

		const response = await identify({ ...codeRead(BIRTH_NUMBER), search_method: PATIENT_IDENTIFICATION_METHOD.NFC_TAG })

		expect(response.status).toBe(HttpStatus.OK)
	})

	it("trims the identifier read from the wristband", async () => {
		await identify(codeRead(` ${BIRTH_NUMBER} `))

		expect(calls.identified).toEqual([codeRead(BIRTH_NUMBER)])
	})

	it("refuses fulltext, an empty value and an unknown field without identifying", async () => {
		const refused = [
			{ ...codeRead(BIRTH_NUMBER), search_method: "fulltext" },
			codeRead(" "),
			{ ...codeRead(BIRTH_NUMBER), family_name: "Novák" },
		]

		for (const body of refused) {
			const response = await identify(body)
			expect(response.status).toBe(HttpStatus.BAD_REQUEST)
			expect(((await response.json()) as { code: string }).code).toBe(ERROR_CODE.RECORD_REJECTED)
		}
		expect(calls.identified).toEqual([])
	})

	it("CAP-013-S21 refuses a value that cannot be a DICOM Patient ID without identifying", async () => {
		const refused = [
			codeRead("7".repeat(PATIENT_ID_MAX_LENGTH + 1)),
			codeRead("5603121234\\RID"),
			codeRead("5603121234\u001d01"),
		]

		for (const body of refused) {
			const response = await identify(body)
			expect(response.status).toBe(HttpStatus.BAD_REQUEST)
			expect(((await response.json()) as { code: string }).code).toBe(ERROR_CODE.RECORD_REJECTED)
		}
		expect(calls.identified).toEqual([])
	})

	it("CAP-013-R10 takes a value of any other structure up to the length of a DICOM Patient ID", async () => {
		const longest = codeRead("R".repeat(PATIENT_ID_MAX_LENGTH))
		const notBirthNumber = codeRead("RID-ž 0042/7")

		await identify(longest)
		await identify(notBirthNumber)

		expect(calls.identified).toEqual([longest, notBirthNumber])
	})
})

describe("search of a patient by the beginning of the identifier over HTTP CHG-182 CAP-013-R07", () => {
	it("CAP-013-S22 answers 200 with the patients the server found", async () => {
		const response = await search("query=991011%2F12")

		expect(response.status).toBe(HttpStatus.OK)
		expect(((await response.json()) as { items: unknown[] }).items).toHaveLength(1)
		expect(calls.searched).toEqual([{ query: "991011/12" }])
	})

	it("CHG-176 refuses the way of searching of the fulltext, a missing query and an unknown parameter", async () => {
		const refused = ["search_method=fulltext&query=Nov%C3%A1k", "", "query=991011&limit=5"]

		for (const query of refused) {
			const response = await search(query)
			expect(response.status).toBe(HttpStatus.BAD_REQUEST)
			expect(((await response.json()) as { code: string }).code).toBe(ERROR_CODE.RECORD_REJECTED)
		}
		expect(calls.searched).toEqual([])
	})

	it("refuses a query no identifier can begin with", async () => {
		const refused = ["query=", "query=991011%5C", "query=991011%1D", `query=${"9".repeat(QUERY_MAX_LENGTH + 1)}`]

		for (const query of refused) {
			const response = await search(query)
			expect(response.status).toBe(HttpStatus.BAD_REQUEST)
			expect(((await response.json()) as { code: string }).code).toBe(ERROR_CODE.RECORD_REJECTED)
		}
		expect(calls.searched).toEqual([])
	})
})
