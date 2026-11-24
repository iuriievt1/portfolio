import "reflect-metadata"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ACCEPTS_ANY_APP_VERSION } from "../../decorators/accepts-any-app-version.decorator"
import { ACCEPTS_OUTDATED_APP_FOR_DRAFT } from "../../decorators/accepts-outdated-app-for-draft.decorator"

const APP_DIRECTORY = join(__dirname, "../../..")
const CONTROLLER_SUFFIX = ".controller.ts"

// index.yaml AppVersion
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
	"uploadDocumentPage",
	"uploadImage",
]

// index.yaml AppVersion, CAP-012-R24
const OPERATIONS_FROM_ANY_APP_VERSION = ["reportDeviceEvents", "reportDeviceIntegrity"]

function controllerFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) {
			return entry.name === "__tests__" ? [] : controllerFiles(path)
		}
		return entry.name.endsWith(CONTROLLER_SUFFIX) ? [path] : []
	})
}

async function operationsMarkedWith(metadataKey: string): Promise<string[]> {
	const marked: string[] = []
	for (const file of controllerFiles(APP_DIRECTORY)) {
		const exports: Record<string, unknown> = await import(file)
		for (const exported of Object.values(exports)) {
			if (typeof exported !== "function") {
				continue
			}
			const prototype = exported.prototype as Record<string, unknown>
			for (const name of Object.getOwnPropertyNames(prototype)) {
				const handler = prototype[name]
				if (typeof handler === "function" && Reflect.getMetadata(metadataKey, handler) === true) {
					marked.push(name)
				}
			}
		}
	}
	return marked.sort()
}

describe("operations an outdated app may still call CAP-012-R25", () => {
	it("CAP-012-S16 are exactly the operations that finish a started draft", async () => {
		expect(await operationsMarkedWith(ACCEPTS_OUTDATED_APP_FOR_DRAFT)).toEqual(OPERATIONS_FINISHING_A_DRAFT)
	})
})

describe("operations the server takes from any app version CAP-012-R24", () => {
	it("CAP-012-S14 are exactly the report of the block and the batch of device events", async () => {
		expect(await operationsMarkedWith(ACCEPTS_ANY_APP_VERSION)).toEqual(OPERATIONS_FROM_ANY_APP_VERSION)
	})
})
