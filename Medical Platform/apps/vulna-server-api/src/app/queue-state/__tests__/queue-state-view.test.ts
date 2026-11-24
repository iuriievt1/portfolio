import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { Device } from "../../device/types/device.types"
import type { CurrentSession } from "../../login/types/login.types"
import { QUEUE_CALLER } from "../constants/queue-state.constants"
import { queueReportSchema } from "../dto/queue-report.input.dto"
import { queueStateQuerySchema } from "../dto/queue-state.input.dto"
import { queueStateScopeOf } from "../utils/queue-caller"
import { queueReportOf } from "../utils/queue-report"
import { acquisitionStateOf, receivedKeysByAcquisition } from "../utils/queue-state-view"

const RECORD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const OTHER_RECORD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const OTHER_KEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const FILE_A = "11111111-1111-4111-8111-111111111111"
const FILE_B = "22222222-2222-4222-8222-222222222222"
const DEVICE = { id: "33333333-3333-4333-8333-333333333333" } as Device
const NURSE = "44444444-4444-4444-8444-444444444444"
const DETECTED_AT = "2026-10-16T08:00:00.000Z"

function row(state: (typeof ACQUISITION_STATE)[keyof typeof ACQUISITION_STATE]) {
	return { id: RECORD, idempotency_key: KEY, state, cursor_moment: "2026-10-16T08:00:00.000000Z" }
}

describe("state of the records of a device CAP-019-R30", () => {
	it("CAP-019-R24 says which files of a draft the server has", () => {
		expect(acquisitionStateOf(row(ACQUISITION_STATE.DRAFT), [FILE_A, FILE_B])).toEqual({
			idempotency_key: KEY,
			acquisition_id: RECORD,
			state: "draft",
			received_file_keys: [FILE_A, FILE_B],
			missing_sequences: [],
			reason: null,
		})
	})

	it("CAP-019-R28 CAP-019-S17 shows every record past the receipt as done", () => {
		const states = [
			ACQUISITION_STATE.RECEIVED,
			ACQUISITION_STATE.ASSEMBLING,
			ACQUISITION_STATE.DELIVERED,
			ACQUISITION_STATE.FAILED,
			ACQUISITION_STATE.CLOSED_BY_ADMINISTRATOR,
		]

		expect(states.map((state) => acquisitionStateOf(row(state), []).state)).toEqual(states.map(() => "received"))
	})

	it("groups the received files by their record", () => {
		const keys = receivedKeysByAcquisition([
			{ acquisition_id: RECORD, file_key: FILE_A },
			{ acquisition_id: OTHER_RECORD, file_key: FILE_B },
			{ acquisition_id: RECORD, file_key: FILE_B },
		])

		expect(keys.get(RECORD)).toEqual([FILE_A, FILE_B])
		expect(keys.get(OTHER_RECORD)).toEqual([FILE_B])
	})

	it("CAP-019-R30 scopes the drafts to their operator in a session", () => {
		const current = { device: DEVICE, session: { userId: NURSE } } as unknown as CurrentSession

		expect(queueStateScopeOf({ kind: QUEUE_CALLER.USER, current }, undefined)).toEqual({
			deviceId: DEVICE.id,
			operatorUserId: NURSE,
			acquisitionKeys: undefined,
		})
	})

	it("CAP-019-R30 scopes out every draft under the device token", () => {
		expect(queueStateScopeOf({ kind: QUEUE_CALLER.DEVICE, device: DEVICE }, [KEY])).toEqual({
			deviceId: DEVICE.id,
			operatorUserId: undefined,
			acquisitionKeys: [KEY],
		})
	})

	it("reads the keys the app asks about from one comma separated value", () => {
		expect(queueStateQuerySchema.parse({ acquisition_keys: `${KEY},${OTHER_KEY}` }).acquisition_keys).toEqual([
			KEY,
			OTHER_KEY,
		])
		expect(queueStateQuerySchema.safeParse({ acquisition_keys: "" }).success).toBe(false)
		expect(queueStateQuerySchema.safeParse({ acquisition_keys: "not-a-key" }).success).toBe(false)
		expect(queueStateQuerySchema.safeParse({ acquisition_keys: `${KEY},${KEY}` }).success).toBe(false)
	})
})

describe("report of the queue on the device CAP-019-R08", () => {
	it("CAP-007-S03 keeps the counts and the time of the oldest unsent item", () => {
		const input = queueReportSchema.parse({
			waiting: 3,
			failed: 1,
			oldest_acquired_at: "2026-10-15T07:18:00.000Z",
			detected_at: DETECTED_AT,
		})

		expect(queueReportOf(input)).toEqual({
			waiting: 3,
			failed: 1,
			oldestAcquiredAt: new Date("2026-10-15T07:18:00.000Z"),
			detectedAt: new Date(DETECTED_AT),
		})
	})

	it("CAP-007-S08 accepts an empty queue, so the administrator can tell it from a device that never reported", () => {
		const input = queueReportSchema.parse({ waiting: 0, failed: 0, oldest_acquired_at: null, detected_at: DETECTED_AT })

		expect(queueReportOf(input).oldestAcquiredAt).toBeUndefined()
	})

	it("refuses a report whose oldest item does not match its counts", () => {
		const withoutOldest = { waiting: 2, failed: 0, oldest_acquired_at: null, detected_at: DETECTED_AT }
		const emptyWithOldest = { waiting: 0, failed: 0, oldest_acquired_at: DETECTED_AT, detected_at: DETECTED_AT }

		expect(queueReportSchema.safeParse(withoutOldest).success).toBe(false)
		expect(queueReportSchema.safeParse(emptyWithOldest).success).toBe(false)
	})

	it("CAP-019-R08 refuses a report that carries anything about a patient or the content", () => {
		const withPatient = {
			waiting: 1,
			failed: 0,
			oldest_acquired_at: DETECTED_AT,
			detected_at: DETECTED_AT,
			patient: "1",
		}

		expect(queueReportSchema.safeParse(withPatient).success).toBe(false)
	})
})
