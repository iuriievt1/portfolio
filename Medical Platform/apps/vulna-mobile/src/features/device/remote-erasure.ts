import {
	backgroundQueue,
	cryptoAndKeys,
	type DeletedItems,
	ERASURE_STATE,
	type ErasurePorts,
	type ErasureState,
	eraseAfterRevocation as eraseWith,
	resumeErasure as resumeWith,
} from "@ansora/core-mobile"
import { randomUuid } from "../../utils/random-uuid"
import { forgetAppVersionAnswer } from "../app-version/app-version-store"
import { forgetCodeLists } from "../code-lists/code-list-store"
import { forgetOwnerLanguage } from "../session/owner-language"
import { forgetSessionOnDevice } from "../session/session-actions"
import { currentSession } from "../session/session-store"
import { queueReportOf } from "../upload/queue-report"
import { reopenQueueStorage, transferBuffer } from "../upload/transfer-store"
import { stopUploadQueue } from "../upload/upload-queue"
import { DEVICE_REPORT_PORTS } from "./device-events"
import { deviceKeyHoldSeconds } from "./device-key-hold"

const NOTHING_COUNTED: DeletedItems = { count: 0, oldestAcquiredAt: null }

let lastErasure: Promise<unknown> = Promise.resolve()
let pendingErasure: Promise<ErasureState> | undefined
let isReleased = false

// CAP-019-R06, zarizeni-a-sifrovani.md 2.1
export async function unsentItems(): Promise<DeletedItems> {
	try {
		const report = queueReportOf(await (await transferBuffer()).queued(), new Date())
		return { count: report.waiting + report.failed, oldestAcquiredAt: report.oldest_acquired_at }
	} catch (failure) {
		console.warn("the unsent items could not be counted before the erasure", failure)
		return NOTHING_COUNTED
	}
}

// CAP-007-R04, CAP-008-R06, CAP-009-R14
export async function eraseLocalData(): Promise<void> {
	await backgroundQueue().cancelAll()
	await reopenQueueStorage()
	await cryptoAndKeys().eraseLocalData()
	await reopenQueueStorage()
	await forgetOwnerLanguage()
	forgetSessionOnDevice()
	forgetCodeLists()
	forgetAppVersionAnswer()
}

export const ERASURE_PORTS: ErasurePorts = {
	...DEVICE_REPORT_PORTS,
	unsentItems,
	eraseLocalData,
	forgetDeviceKey: () => cryptoAndKeys().forgetDeviceKey(),
	newEventKey: randomUuid,
	now: () => new Date(),
}

export function afterEarlierErasure<T>(work: () => Promise<T>): Promise<T> {
	const run = lastErasure.then(work, work)
	lastErasure = run.catch(() => undefined)
	return run
}

async function unlessReleased(work: () => Promise<ErasureState>): Promise<ErasureState> {
	if (isReleased) {
		return ERASURE_STATE.RELEASED
	}
	const state = await work()
	isReleased = state === ERASURE_STATE.RELEASED
	return state
}

// CAP-007-R04, CAP-007-R11, CAP-012-S15
export function eraseAfterRevocation(): Promise<ErasureState> {
	pendingErasure ??= afterEarlierErasure(() => unlessReleased(erase)).finally(() => {
		pendingErasure = undefined
	})
	return pendingErasure
}

// CAP-025-R22, CAP-025-S15, CAP-025-S16
export function resumeErasure(): Promise<ErasureState> {
	return afterEarlierErasure(() => unlessReleased(() => resumeWith(ERASURE_PORTS)))
}

async function erase(): Promise<ErasureState> {
	stopUploadQueue()
	const context = { userId: currentSession()?.user.id ?? null, deviceKeyHoldSeconds: await deviceKeyHoldSeconds() }
	return await eraseWith(ERASURE_PORTS, context)
}
