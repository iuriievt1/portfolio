import { describe, expect, it } from "vitest"
import { administeredAcquisitionViewOf, fileCountOf } from "../utils/administered-acquisition-view"
import { CONFIRMED_INSTANCE, DELIVERED, DRAFT, PATIENT } from "./acquisition-administration-fixtures"

const RECEIVED_FILES = 2
const RETIRED_DELIVERY_STATE = "clinical_safety"

describe("acquisition for the administrator CAP-004-R10", () => {
	it("CAP-012-R19 carries the configuration version the acquisition was made under", () => {
		const view = administeredAcquisitionViewOf(DELIVERED, { patient: PATIENT, fileCount: 3, instances: undefined })

		expect(view.configuration_version).toEqual({
			version: DELIVERED.configuration_version,
			created_at: DELIVERED.configuration_created_at.toISOString(),
			author_user_id: DELIVERED.configuration_author_user_id,
			reason: DELIVERED.configuration_reason,
		})
		expect(view).toMatchObject({
			operator_user_id: DELIVERED.operator_user_id,
			device_id: DELIVERED.closing_device_id,
			started_at: DELIVERED.started_at.toISOString(),
			closed_at: DELIVERED.closed_at?.toISOString(),
		})
	})

	it("leaves out the closing device, the close time and the series a draft does not have yet", () => {
		const view = administeredAcquisitionViewOf(DRAFT, { patient: PATIENT, fileCount: 0, instances: [] })

		expect(view.closed_at).toBeNull()
		expect(view.device_id).toBeUndefined()
		expect(view.series_instance_uid).toBeUndefined()
		expect(view.instance).toEqual([])
	})

	it("shows an instance without a delivery state the contract does not know", () => {
		const view = administeredAcquisitionViewOf(DELIVERED, {
			patient: PATIENT,
			fileCount: 3,
			instances: [{ ...CONFIRMED_INSTANCE, delivery_state: RETIRED_DELIVERY_STATE }],
		})

		expect(view.instance).toEqual([
			{ sop_instance_uid: CONFIRMED_INSTANCE.sop_instance_uid, sop_class: CONFIRMED_INSTANCE.sop_class_uid },
		])
	})

	it("CAP-021-R25 counts the announced files of a closed record and the held files of a draft", () => {
		const received = new Map([
			[DELIVERED.id, RECEIVED_FILES],
			[DRAFT.id, RECEIVED_FILES],
		])

		expect(fileCountOf(DELIVERED, received)).toBe(DELIVERED.file_count)
		expect(fileCountOf(DRAFT, received)).toBe(RECEIVED_FILES)
		expect(fileCountOf(DRAFT, new Map())).toBe(0)
		expect(() => fileCountOf({ ...DELIVERED, file_count: null }, received)).toThrow()
	})
})
