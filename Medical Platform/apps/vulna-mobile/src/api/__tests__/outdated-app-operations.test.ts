import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { acquisitionFileApi } from "../acquisition-files"
import { acquisitionApi } from "../acquisitions"
import type { ApiRequest, VersionCheck } from "../client"
import { codeListApi } from "../code-lists"
import { reportDeviceEvents, reportDeviceIntegrity } from "../device"
import { findingApi } from "../findings"

const calls = vi.hoisted(() => [] as (boolean | undefined)[])

vi.mock("../client", () => ({
	ACCEPTS_OUTDATED_APP: { acceptsOutdatedApp: true },
	callApi: async (_path: string, request: ApiRequest) => {
		calls.push(request.acceptsOutdatedApp)
		return {}
	},
	callApiResponse: async (_path: string, request: ApiRequest) => {
		calls.push(request.acceptsOutdatedApp)
		return new Response("")
	},
}))
vi.mock("../../features/session/effective-configuration-store", () => ({
	rememberEffectiveConfiguration: () => undefined,
}))
vi.mock("../file-transfer", () => ({
	sendMultipart: async (...parts: unknown[]) => {
		calls.push((parts.at(-1) as VersionCheck).acceptsOutdatedApp)
		return new Response("{}")
	},
}))

const TOKEN = "session-token"
const DRAFT = { acquisition_id: "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10", version: 3 }
const FILE_KEY = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
const REPLACEMENT = {
	file: { path: "/vault/queue/a", envelope: { enc: "e", suite: "s", server_key_version: "1" } },
	thumbnail: { path: "/vault/queue/b", envelope: { enc: "e", suite: "s", server_key_version: "1" } },
	sha256: "ab".repeat(32),
	edit: "rotation",
} as unknown as Parameters<typeof acquisitionFileApi.replaceAcquisitionFile>[3]

// index.yaml AppVersion, vulna-server-api outdated-app-operations.test.ts
const OPERATIONS: Readonly<Record<string, () => Promise<unknown>>> = {
	announceAcquisitionFile: () =>
		acquisitionFileApi.announceAcquisitionFile(TOKEN, DRAFT.acquisition_id, FILE_KEY, {} as never, undefined),
	cancelAcquisitionDraft: () => acquisitionApi.cancelAcquisitionDraft(TOKEN, DRAFT.acquisition_id),
	changeFindingWoundType: () => findingApi.changeFindingWoundType(TOKEN, FILE_KEY, {} as never),
	closeAcquisition: () => acquisitionApi.closeAcquisition(TOKEN, DRAFT, {} as never),
	createAcquisitionDraft: () => acquisitionApi.createAcquisitionDraft(TOKEN, {} as never, FILE_KEY),
	discardAcquisitionDraft: () => acquisitionApi.discardAcquisitionDraft(TOKEN, DRAFT, {} as never),
	getAcquisitionDraft: () => acquisitionApi.getAcquisitionDraft(TOKEN, DRAFT.acquisition_id),
	getBodyDiagramBackground: () => codeListApi.getBodyDiagramBackground(TOKEN, "/body-diagram/front"),
	getFindingHistory: () => findingApi.getFindingHistory(TOKEN, FILE_KEY, undefined),
	listAcquisitionDrafts: () => acquisitionApi.listAcquisitionDrafts(TOKEN, undefined),
	listPatientFindings: () => findingApi.listPatientFindings(TOKEN, FILE_KEY, undefined),
	removeAcquisitionFile: () => acquisitionFileApi.removeAcquisitionFile(TOKEN, DRAFT, FILE_KEY),
	replaceAcquisitionFile: () => acquisitionFileApi.replaceAcquisitionFile(TOKEN, DRAFT, FILE_KEY, REPLACEMENT),
	setAcquisitionAssignment: () => acquisitionApi.setAcquisitionAssignment(TOKEN, DRAFT, {} as never),
	setAcquisitionFileOrder: () => acquisitionFileApi.setAcquisitionFileOrder(TOKEN, DRAFT, [FILE_KEY]),
	syncCodeLists: () => codeListApi.syncCodeLists(TOKEN, undefined),
	updateAcquisitionDraft: () => acquisitionApi.updateAcquisitionDraft(TOKEN, DRAFT, {}, FILE_KEY),
}

const API_DIRECTORY = resolve(__dirname, "..")
const MODULES_MARKING_OUTDATED_APP = [
	"acquisition-files.ts",
	"acquisitions.ts",
	"client.ts",
	"code-lists.ts",
	"device.ts",
	"findings.ts",
]

const OPERATIONS_FINISHING_A_DRAFT = [
	"announceAcquisitionFile",
	"closeAcquisition",
	"getAcquisitionDraft",
	"getBodyDiagramBackground",
	"listAcquisitionDrafts",
	"listPatientFindings",
	"removeAcquisitionFile",
	"replaceAcquisitionFile",
	"setAcquisitionFileOrder",
	"syncCodeLists",
	"updateAcquisitionDraft",
]

beforeEach(() => {
	calls.length = 0
})

describe("requests an outdated app may still send CAP-012-R25", () => {
	it("CAP-012-S16 E34 marks exactly the operations that finish a started draft", async () => {
		const marked: string[] = []
		for (const [name, call] of Object.entries(OPERATIONS)) {
			calls.length = 0
			await call()
			if (calls.at(-1) === true) {
				marked.push(name)
			}
		}

		expect(marked).toEqual(OPERATIONS_FINISHING_A_DRAFT)
	})

	it("CAP-012-R24 sends the batch of device events also from an outdated app", async () => {
		await reportDeviceEvents([])

		expect(calls).toEqual([true])
	})

	it("CAP-012-R24 CAP-012-S14 reports the block of the device also from an outdated app", async () => {
		await reportDeviceIntegrity({
			signals: ["root"],
			detected_at: "2026-10-29T08:00:00.000Z",
			unsent_items: { count: 0, oldest_acquired_at: null },
		})

		expect(calls).toEqual([true])
	})

	it("CAP-012-R25 lets no other module of the client send a request an outdated app may still send", () => {
		const marking = readdirSync(API_DIRECTORY)
			.filter((name) => name.endsWith(".ts"))
			.filter((name) => readFileSync(resolve(API_DIRECTORY, name), "utf8").includes("ACCEPTS_OUTDATED_APP"))

		expect(marking.sort()).toEqual(MODULES_MARKING_OUTDATED_APP)
	})
})
