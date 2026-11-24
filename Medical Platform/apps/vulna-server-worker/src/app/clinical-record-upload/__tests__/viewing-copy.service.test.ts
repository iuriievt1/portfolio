import { ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { CONFIGURATION_KEY, JOB_OBJECT_KIND } from "@ansora/core-server"
import { decode } from "jpeg-js"
import { describe, expect, it } from "vitest"
import type { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { ViewingCopyService } from "../services/viewing-copy.service"
import type { ViewingCopyRendererService } from "../services/viewing-copy-renderer.service"
import { ORIENTATION } from "../utils/jpeg-segments"
import { viewingCopyOf } from "../utils/viewing-copy"
import { photoOf, rasterOf } from "./jpeg-fixtures"
import { FILE_ID, fileOf, sha256Of, TASK_ID, type UploadHarnessOptions, UploadWorld } from "./upload-fixtures"

const MAX_LONG_EDGE_PX = 16
const QUALITY = 70
const PHOTO = photoOf(
	rasterOf(64, 32, () => [200, 120, 90]),
	ORIENTATION.ROTATED_90,
)
const WITHOUT_COPY = fileOf({ viewingCopy: undefined })

interface ViewingCopyHarnessOptions extends UploadHarnessOptions {
	original?: Uint8Array
	isOriginalInBuffer?: boolean
	isOriginalReadable?: boolean
	configurationFailure?: Error
}

function harness(options: ViewingCopyHarnessOptions = {}) {
	const world = new UploadWorld({ file: WITHOUT_COPY, ...options })
	if (options.isOriginalInBuffer === false) {
		world.buffer.delete(WITHOUT_COPY.original.binaryObjectId)
	} else {
		world.buffer.set(WITHOUT_COPY.original.binaryObjectId, options.original ?? PHOTO)
	}
	if (options.isOriginalReadable === false) {
		world.unreadable.add(WITHOUT_COPY.original.binaryObjectId)
	}
	const configuration = {
		effectiveValues: async () => {
			if (options.configurationFailure !== undefined) {
				throw options.configurationFailure
			}
			return new Map<string, unknown>([
				[CONFIGURATION_KEY.VIEWING_COPY_MAX_LONG_EDGE_PX, MAX_LONG_EDGE_PX],
				[CONFIGURATION_KEY.VIEWING_COPY_FORMAT, "jpeg"],
				[CONFIGURATION_KEY.VIEWING_COPY_QUALITY, QUALITY],
			])
		},
	} as unknown as ConfigurationService
	const service = new ViewingCopyService(
		world.asDatabase(),
		world.asTasks(),
		world.asAlerts(),
		world.asAudit(),
		world.asFiles(),
		configuration,
		{ copyOf: async (original, settings) => viewingCopyOf(original, settings) } as ViewingCopyRendererService,
		world.asBinaryStore(),
	)
	return { world, service }
}

describe("viewing copy made at closure CAP-021-R40, ADR-050 bod 13", () => {
	it("makes the copy from the original in the buffer, keeps it there and attaches it to the photo", async () => {
		const run = harness()

		await run.service.runNext()

		const copy = run.world.attachedCopies[0]
		expect(copy).toBeDefined()
		const bytes = run.world.buffer.get(copy?.binaryObjectId ?? "")
		expect(bytes).toBeDefined()
		expect(copy).toEqual({
			binaryObjectId: copy?.binaryObjectId,
			sizeBytes: bytes?.length,
			sha256: sha256Of(bytes ?? new Uint8Array()),
		})
		expect(run.world.steps).toEqual([
			`put ${copy?.binaryObjectId}`,
			`attach copy of ${JOB_OBJECT_KIND.IMAGE} ${FILE_ID}`,
			`complete ${TASK_ID}`,
		])
	})

	it("sizes the copy by the configured longer edge", async () => {
		const run = harness()

		await run.service.runNext()

		const image = decode(run.world.buffer.get(run.world.attachedCopies[0]?.binaryObjectId ?? "") ?? Buffer.alloc(0))
		expect({ width: image.width, height: image.height }).toEqual({ width: 8, height: MAX_LONG_EDGE_PX })
	})

	it("CAP-021-R40 alerts the administrator and leaves the photo with its original and thumbnail when the copy fails", async () => {
		const run = harness({ original: Buffer.from("not a photo") })

		await run.service.runNext()

		expect(run.world.attachedCopies).toEqual([])
		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toEqual([
			{
				kind: ADMINISTRATOR_ALERT_KIND.VIEWING_COPY_GENERATION_FAILED,
				taskId: TASK_ID,
				message: expect.stringContaining(`vyrobit prohlížecí kopii snímku ${FILE_ID}`),
			},
		])
	})

	it("CAP-021-R40 alerts the administrator and leaves the photo without a copy when the buffer holds no original", async () => {
		const run = harness({ isOriginalInBuffer: false })

		await run.service.runNext()

		expect(run.world.attachedCopies).toEqual([])
		expect(run.world.steps).toEqual([`fail ${TASK_ID}`])
		expect(run.world.alerts).toEqual([
			{
				kind: ADMINISTRATOR_ALERT_KIND.VIEWING_COPY_GENERATION_FAILED,
				taskId: TASK_ID,
				message: expect.stringContaining(`vyrobit prohlížecí kopii snímku ${FILE_ID}`),
			},
		])
	})

	it("CAP-021-R40 waits and tries again without an alert while the original cannot be read from the buffer", async () => {
		const run = harness({ isOriginalReadable: false })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`retry ${TASK_ID}`])
		expect(run.world.alerts).toEqual([])
	})

	it("konfigurace-a-profily.md 2.1 claims no task while the configuration cannot be read", async () => {
		const run = harness({ configurationFailure: new Error("the database is not reachable") })

		await expect(run.service.runNext()).rejects.toThrow("the database is not reachable")

		expect(run.world.claims).toBe(0)
		expect(run.world.steps).toEqual([])
		expect(run.world.alerts).toEqual([])
	})

	it("makes no second copy of a photo that has one", async () => {
		const run = harness({ file: fileOf() })

		await run.service.runNext()

		expect(run.world.steps).toEqual([`complete ${TASK_ID}`])
	})
})
