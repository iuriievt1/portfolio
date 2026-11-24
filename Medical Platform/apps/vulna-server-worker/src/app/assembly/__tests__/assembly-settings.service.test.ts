import { UNVERSIONED_RELEASE } from "@ansora/contracts"
import { CONFIGURATION_KEY } from "@ansora/core-server"
import { type ClosedRecordReaderPort, LONG_STRING_MAX_LENGTH } from "@ansora/vulna-domain"
import { TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { ImplementationIdentityService } from "../../../libs/pacs/implementation-identity.service"
import { ASSEMBLY_PAUSE } from "../constants/assembly.constants"
import type { AssemblyPauseService } from "../services/assembly-pause.service"
import { AssemblySettingsService } from "../services/assembly-settings.service"
import type { ClosedRecordReaderService } from "../services/closed-record-reader.service"
import { IMPLEMENTATION_CLASS_UID, LANGUAGE, PATIENT_ID_SYSTEM, RELEASE } from "./assembly-fixtures"

const READER = {} as ClosedRecordReaderPort
const LONGEST_VERSION_NAME = "1.0.0-rc.1234567"
const LONG_RELEASE = "v1.0.0-12-g5148fb6b-dirty"
const LANGUAGE_WITHOUT_TEXTS = "de"

const VALUES: ReadonlyArray<readonly [string, unknown]> = [
	[CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID, IMPLEMENTATION_CLASS_UID],
	[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, PATIENT_ID_SYSTEM],
	[CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES, [TRANSFER_SYNTAX.JPEG_BASELINE]],
	[
		CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
		[TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN],
	],
	[CONFIGURATION_KEY.DEFAULT_LANGUAGE, LANGUAGE],
]

function settingsWith(changes: ReadonlyArray<readonly [string, unknown]> = [], isStoreReadable = true) {
	const values = new Map<string, unknown>([...VALUES, ...changes])
	const configuration = { effectiveValues: async () => values } as unknown as ConfigurationService
	const readers = { current: () => (isStoreReadable ? READER : undefined) } as unknown as ClosedRecordReaderService
	const steps: string[] = []
	const pauses = {
		paused: async (pause: string) => {
			steps.push(`paused ${pause}`)
		},
		resumed: async () => {
			steps.push("resumed")
		},
	} as unknown as AssemblyPauseService
	const service = new AssemblySettingsService(
		configuration,
		new ImplementationIdentityService(new EnvVariableService()),
		readers,
		pauses,
	)
	return { current: async () => await service.current(), steps }
}

beforeEach(() => {
	vi.stubEnv(EnvVariable.SERVER_VERSION, undefined)
})

afterEach(() => {
	vi.unstubAllEnvs()
})

describe("settings of the assembly CAP-021-R17 CAP-012-R17", () => {
	it("integrace-dicom.md 3, 4, 5.0 takes the syntaxes, the Implementation Class UID and the release in their order", async () => {
		vi.stubEnv(EnvVariable.SERVER_VERSION, RELEASE)

		expect(await settingsWith().current()).toEqual({
			imageTransferSyntaxes: [TRANSFER_SYNTAX.JPEG_BASELINE],
			documentTransferSyntaxes: [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN],
			identity: { implementationClassUid: IMPLEMENTATION_CLASS_UID, implementationVersionName: RELEASE },
			language: LANGUAGE,
			softwareVersion: RELEASE,
			patientIdSystem: PATIENT_ID_SYSTEM,
			reader: READER,
		})
	})

	it("CAP-021-S38 resumes the assembly whenever the settings allow it", async () => {
		const settings = settingsWith()

		await settings.current()

		expect(settings.steps).toEqual(["resumed"])
	})

	it("CAP-021-R17 keeps the order of the document syntaxes the administrator chose", async () => {
		const settings = await settingsWith([
			[
				CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
				[TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN],
			],
		]).current()

		expect(settings?.documentTransferSyntaxes).toEqual([
			TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN,
			TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN,
		])
	})

	it("integrace-dicom.md 5.0 names an unversioned build and leaves out a release longer than 16 characters", async () => {
		expect((await settingsWith().current())?.identity.implementationVersionName).toBe(UNVERSIONED_RELEASE)

		vi.stubEnv(EnvVariable.SERVER_VERSION, LONGEST_VERSION_NAME)
		expect((await settingsWith().current())?.identity.implementationVersionName).toBe(LONGEST_VERSION_NAME)

		vi.stubEnv(EnvVariable.SERVER_VERSION, LONG_RELEASE)
		const settings = await settingsWith().current()
		expect(settings?.identity.implementationVersionName).toBeUndefined()
		expect(settings?.softwareVersion).toBe(LONG_RELEASE)
	})

	it.each([
		[
			"no Implementation Class UID",
			[[CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID, null]],
			ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING,
		],
		[
			"an Implementation Class UID that is no DICOM UID",
			[[CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID, "1.02.3"]],
			ASSEMBLY_PAUSE.IMPLEMENTATION_CLASS_UID_MISSING,
		],
		[
			"no identifier system of the patient",
			[[CONFIGURATION_KEY.PATIENT_CODE_SYSTEM, null]],
			ASSEMBLY_PAUSE.PATIENT_ID_SYSTEM_MISSING,
		],
		["no default language", [[CONFIGURATION_KEY.DEFAULT_LANGUAGE, null]], ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS],
		[
			"a default language without DICOM texts",
			[[CONFIGURATION_KEY.DEFAULT_LANGUAGE, LANGUAGE_WITHOUT_TEXTS]],
			ASSEMBLY_PAUSE.LANGUAGE_WITHOUT_TEXTS,
		],
		[
			"an image syntax the server does not build",
			[[CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES, [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN]]],
			ASSEMBLY_PAUSE.TRANSFER_SYNTAXES_UNSUPPORTED,
		],
		[
			"no document syntax",
			[[CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES, []]],
			ASSEMBLY_PAUSE.TRANSFER_SYNTAXES_UNSUPPORTED,
		],
		[
			"a document syntax twice",
			[
				[
					CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES,
					[TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN],
				],
			],
			ASSEMBLY_PAUSE.TRANSFER_SYNTAXES_UNSUPPORTED,
		],
	] as const)(
		"CAP-021-S38 waits instead of failing records with %s and tells the administrator",
		async (_, changes, pause) => {
			const settings = settingsWith(changes)

			expect(await settings.current()).toBeUndefined()
			expect(settings.steps).toEqual([`paused ${pause}`])
		},
	)

	it("integrace-dicom.md 5.7 waits with a release that does not fit Software Versions", async () => {
		vi.stubEnv(EnvVariable.SERVER_VERSION, "x".repeat(LONG_STRING_MAX_LENGTH + 1))
		const settings = settingsWith()

		expect(await settings.current()).toBeUndefined()
		expect(settings.steps).toEqual([`paused ${ASSEMBLY_PAUSE.RELEASE_UNFIT}`])
	})

	it("ADR-054 bod 4 waits until the clinical record store can be read", async () => {
		const settings = settingsWith([], false)

		expect(await settings.current()).toBeUndefined()
		expect(settings.steps).toEqual([`paused ${ASSEMBLY_PAUSE.CLINICAL_RECORD_STORE_UNCONFIGURED}`])
	})
})
