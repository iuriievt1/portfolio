import type { DeviceEvent, IntegrityReport } from "@ansora/contracts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const DETECTED_AT = new Date("2026-10-29T08:00:00.000Z")
const REPORTED_AT = new Date("2026-10-29T08:05:00.000Z")
const AFTER_DEFAULT_HOLD = new Date("2026-11-05T08:00:00.000Z")
const OLDEST_UNSENT = "2026-10-28T07:00:00.000Z"
const EVENT_KEY = "33333333-3333-4333-8333-333333333333"
const DEVICE_REPORT_KEY = "ansora.vulna.device-report"

type ServerMode = "online" | "offline"

const phone = vi.hoisted(() => ({
	storage: new Map<string, string>(),
	signals: [] as string[],
	key: 1 as number | undefined,
	lastKey: 1,
	unsent: { waiting: 0, failed: 0, oldest: null as string | null },
	steps: [] as string[],
	server: {
		mode: "online" as "online" | "offline",
		reports: [] as unknown[],
		batches: [] as unknown[][],
	},
}))

vi.mock("expo", async () => {
	const { createHash } = await import("node:crypto")
	const modules: Record<string, unknown> = {
		OsIntegrity: {
			detect: async () => [...phone.signals],
			addListener: () => ({ remove: () => undefined }),
		},
		CryptoAndKeys: {
			deviceKey: async () => {
				phone.key ??= ++phone.lastKey
				return {
					publicKeyJwk: { kty: "EC", crv: "P-256", x: `x-${phone.key}`, y: `y-${phone.key}` },
					secureHardware: "strongbox",
				}
			},
			sha256Text: async (text: string) => createHash("sha256").update(text).digest("base64url"),
			eraseLocalData: async () => {
				phone.steps.push("erase local data")
			},
			forgetDeviceKey: async () => {
				phone.steps.push("forget device key")
				phone.key = undefined
			},
		},
		BackgroundQueue: {
			cancelAll: async () => {
				phone.steps.push("cancel uploads")
			},
		},
	}
	return {
		requireNativeModule: (name: string) => modules[name],
		requireOptionalNativeModule: () => null,
		requireNativeView: () => () => null,
	}
})
vi.mock("react-native", () => ({ Platform: { OS: "android" } }))
vi.mock("react-native-nfc-manager", () => ({ default: {}, Ndef: {}, NfcError: {}, NfcTech: {} }))
vi.mock("expo-sqlite", () => ({}))
vi.mock("expo-secure-store", () => ({
	getItemAsync: async (key: string) => phone.storage.get(key) ?? null,
	setItemAsync: async (key: string, value: string) => {
		phone.storage.set(key, value)
	},
	deleteItemAsync: async (key: string) => {
		phone.storage.delete(key)
	},
}))
vi.mock("../../../api/device", () => {
	function reachable(): void {
		if (phone.server.mode === "offline") {
			throw new TypeError("Network request failed")
		}
	}
	return {
		reportDeviceIntegrity: async (report: IntegrityReport) => {
			phone.steps.push("server: report")
			reachable()
			phone.server.reports.push(report)
		},
		reportDeviceEvents: async (events: readonly DeviceEvent[]) => {
			phone.steps.push("server: events")
			reachable()
			phone.server.batches.push([...events])
			return { recorded_keys: events.map((event) => event.idempotency_key) }
		},
	}
})
vi.mock("../../upload/upload-queue", () => ({
	stopUploadQueue: () => {
		phone.steps.push("stop uploads")
	},
}))
vi.mock("../../upload/queue-report", () => ({
	queueReportOf: () => ({
		waiting: phone.unsent.waiting,
		failed: phone.unsent.failed,
		oldest_acquired_at: phone.unsent.oldest,
	}),
}))
vi.mock("../../upload/transfer-store", () => ({
	reopenQueueStorage: async () => undefined,
	transferBuffer: async () => ({ queued: async () => [] }),
}))
vi.mock("../../session/session-store", () => ({ currentSession: () => undefined }))
vi.mock("../../session/session-actions", () => ({ forgetSessionOnDevice: () => undefined }))
vi.mock("../../session/owner-language", () => ({ forgetOwnerLanguage: async () => undefined }))
vi.mock("../../code-lists/code-list-store", () => ({ forgetCodeLists: () => undefined }))
vi.mock("../../app-version/app-version-store", () => ({ forgetAppVersionAnswer: () => undefined }))
vi.mock("../../../utils/random-uuid", () => ({ randomUuid: async () => EVENT_KEY }))

async function startedApp() {
	vi.resetModules()
	return {
		core: await import("@ansora/core-mobile"),
		integrity: await import("../device-integrity"),
		erasure: await import("../integrity-erasure"),
		markers: await import("../block-markers"),
		registration: await import("../device-registration"),
		delivery: await import("../block-delivery"),
		remoteErasure: await import("../remote-erasure"),
	}
}

type App = Awaited<ReturnType<typeof startedApp>>

async function settled(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

async function registeredApp(): Promise<App> {
	const app = await startedApp()
	app.registration.rememberRegistration({ kind: app.core.DEVICE_STATUS.APPROVED })
	await settled()
	return app
}

async function blockedAndErased(app: App) {
	const block = await app.integrity.checkDeviceIntegrity()
	if (block === undefined) {
		throw new Error("the app did not block the device")
	}
	return await app.erasure.eraseAfterIntegrityBlock(block)
}

function serverIs(mode: ServerMode): void {
	phone.server.mode = mode
}

function deletionOf(count: number, oldest: string | null): DeviceEvent {
	return {
		idempotency_key: EVENT_KEY,
		type: "local-data-deletion",
		originated_at: DETECTED_AT.toISOString(),
		user_id: null,
		details: { reason: "os_modification", count, oldest_acquired_at: oldest },
	}
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] })
	vi.setSystemTime(DETECTED_AT)
	phone.storage.clear()
	phone.signals = []
	phone.key = 1
	phone.lastKey = 1
	phone.unsent = { waiting: 0, failed: 0, oldest: null }
	phone.steps.length = 0
	phone.server.mode = "online"
	phone.server.reports.length = 0
	phone.server.batches.length = 0
	vi.spyOn(console, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe("CAP-008-S10 modification found before the registration", () => {
	it("CAP-008-R13 blocks, erases what the app had and tells the server nothing", async () => {
		phone.signals = ["magisk"]
		const app = await startedApp()

		const erased = await blockedAndErased(app)
		const shown = await app.erasure.reportBlockToServer(erased)

		expect(shown).toEqual({
			detectedAt: DETECTED_AT.toISOString(),
			signals: ["magisk"],
			registered: false,
			unsentItems: { count: 0, oldestAcquiredAt: null },
		})
		expect(phone.steps).toEqual(["stop uploads", "cancel uploads", "erase local data"])
		expect(phone.server.reports).toEqual([])
		expect(phone.server.batches).toEqual([])
		expect(phone.storage.has(DEVICE_REPORT_KEY)).toBe(false)
	})

	it("CAP-008-R13 stays blocked and offers no registration after the modification is gone", async () => {
		phone.signals = ["magisk"]
		const app = await startedApp()
		const shown = await app.erasure.reportBlockToServer(await blockedAndErased(app))
		phone.signals = []

		const restarted = await startedApp()

		expect(await restarted.integrity.checkDeviceIntegrity()).toEqual(shown)
		expect(await restarted.integrity.leaveIntegrityBlock()).toBe(false)
		expect(await restarted.markers.blockedPredecessor()).toEqual({})
		expect(phone.server.reports).toEqual([])
	})
})

describe("CAP-008-S01 CAP-008-S07 modification found on a registered device with a connection", () => {
	it("CAP-008-R06 erases the unsent records, reports the block before the deletion and only then lets the key go", async () => {
		phone.signals = ["magisk"]
		phone.unsent = { waiting: 3, failed: 1, oldest: OLDEST_UNSENT }
		const app = await registeredApp()
		const blockedHwId = await app.core.hardwareIdOf(app.core.cryptoAndKeys())

		const erased = await blockedAndErased(app)
		vi.setSystemTime(REPORTED_AT)
		const shown = await app.erasure.reportBlockToServer(erased)

		expect(phone.steps).toEqual([
			"stop uploads",
			"cancel uploads",
			"erase local data",
			"server: report",
			"server: events",
			"forget device key",
		])
		expect(phone.server.reports).toEqual([
			{
				signals: ["magisk"],
				detected_at: DETECTED_AT.toISOString(),
				unsent_items: { count: 4, oldest_acquired_at: OLDEST_UNSENT },
			},
		])
		expect(phone.server.batches).toEqual([[deletionOf(4, OLDEST_UNSENT)]])
		expect(shown).toMatchObject({ registered: true, hwId: blockedHwId, reportedAt: REPORTED_AT.toISOString() })
		expect(app.delivery.deliveryOf(shown)).toBe(app.delivery.BLOCK_DELIVERY.REPORTED)
	})

	it("CAP-006-S13 leaves the block for a new registration with the marker of the predecessor once root is gone", async () => {
		phone.signals = ["magisk"]
		const app = await registeredApp()
		const blockedHwId = await app.core.hardwareIdOf(app.core.cryptoAndKeys())
		await app.erasure.reportBlockToServer(await blockedAndErased(app))
		phone.signals = []

		const restarted = await startedApp()

		expect(await restarted.integrity.checkDeviceIntegrity()).toBeUndefined()
		expect(await restarted.markers.blockedPredecessor()).toEqual({ blockedPredecessorHwId: blockedHwId })
		expect(await restarted.registration.isDeviceRegistered()).toBe(false)
		expect(await restarted.core.hardwareIdOf(restarted.core.cryptoAndKeys())).not.toBe(blockedHwId)
	})

	it("CAP-025-R22 records no second deletion at a restart after the key was let go and registers once root is gone", async () => {
		phone.signals = ["magisk"]
		const app = await registeredApp()
		const blockedHwId = await app.core.hardwareIdOf(app.core.cryptoAndKeys())
		await app.erasure.reportBlockToServer(await blockedAndErased(app))
		phone.steps.length = 0

		const stillRooted = await startedApp()
		const stored = await stillRooted.integrity.checkDeviceIntegrity()
		if (stored === undefined) {
			throw new Error("the app let a modified device work")
		}
		await stillRooted.erasure.reportBlockToServer(await stillRooted.erasure.eraseAfterIntegrityBlock(stored))

		expect(phone.storage.has(DEVICE_REPORT_KEY)).toBe(false)
		expect(phone.steps).toEqual(["stop uploads", "cancel uploads", "erase local data"])

		phone.signals = []
		const cleaned = await startedApp()

		expect(await cleaned.integrity.checkDeviceIntegrity()).toBeUndefined()
		expect(await cleaned.remoteErasure.resumeErasure()).toBe(cleaned.core.ERASURE_STATE.NONE)
		expect(await cleaned.markers.blockedPredecessor()).toEqual({ blockedPredecessorHwId: blockedHwId })
	})

	it("CAP-008-S04 keeps the device blocked while the modification is still found", async () => {
		phone.signals = ["magisk"]
		const app = await registeredApp()
		const shown = await app.erasure.reportBlockToServer(await blockedAndErased(app))

		const restarted = await startedApp()

		expect(await restarted.integrity.checkDeviceIntegrity()).toEqual(shown)
		expect(await restarted.markers.blockedPredecessor()).toEqual({})
	})
})

describe("CAP-008-S03 modification found without a connection to the server", () => {
	it("Q-072 blocks and erases at once and keeps the device key and the deletion for later", async () => {
		phone.signals = ["debugger"]
		serverIs("offline")
		const app = await registeredApp()

		const shown = await app.erasure.reportBlockToServer(await blockedAndErased(app))

		expect(phone.steps).toEqual(["stop uploads", "cancel uploads", "erase local data", "server: report"])
		expect(phone.server.reports).toEqual([])
		expect(phone.key).toBe(1)
		expect(phone.storage.has(DEVICE_REPORT_KEY)).toBe(true)
		expect(app.delivery.deliveryOf(shown)).toBe(app.delivery.BLOCK_DELIVERY.AWAITING)
	})

	it("CAP-025-R22 stays blocked while the device key still waits for the report, even once the debugger is gone", async () => {
		phone.signals = ["debugger"]
		serverIs("offline")
		const app = await registeredApp()
		const waiting = await app.erasure.reportBlockToServer(await blockedAndErased(app))
		phone.signals = []

		const restarted = await startedApp()

		expect(await restarted.integrity.checkDeviceIntegrity()).toEqual(waiting)
		expect(await restarted.markers.blockedPredecessor()).toEqual({})
		expect(phone.key).toBe(1)
	})

	it("CAP-025-S15 reports the block and then the deletion once the connection is back", async () => {
		phone.signals = ["debugger"]
		serverIs("offline")
		const app = await registeredApp()
		const waiting = await app.erasure.reportBlockToServer(await blockedAndErased(app))
		serverIs("online")
		vi.setSystemTime(REPORTED_AT)
		phone.steps.length = 0

		const shown = await app.erasure.reportBlockToServer(waiting)

		expect(phone.steps).toEqual(["server: report", "server: events", "forget device key"])
		expect(phone.server.reports).toHaveLength(1)
		expect(phone.server.batches).toEqual([[deletionOf(0, null)]])
		expect(app.delivery.deliveryOf(shown)).toBe(app.delivery.BLOCK_DELIVERY.REPORTED)
	})

	it("CAP-025-S16 lets the key go after the hold without a connection and stops promising the report", async () => {
		phone.signals = ["debugger"]
		serverIs("offline")
		const app = await registeredApp()
		const waiting = await app.erasure.reportBlockToServer(await blockedAndErased(app))
		vi.setSystemTime(AFTER_DEFAULT_HOLD)
		phone.steps.length = 0

		const shown = await app.erasure.reportBlockToServer(waiting)

		expect(phone.steps).toEqual(["forget device key"])
		expect(phone.server.reports).toEqual([])
		expect(phone.server.batches).toEqual([])
		expect(shown.reportAbandonedAt).toBe(AFTER_DEFAULT_HOLD.toISOString())
		expect(app.delivery.deliveryOf(shown)).toBe(app.delivery.BLOCK_DELIVERY.UNREPORTED)
	})
})
