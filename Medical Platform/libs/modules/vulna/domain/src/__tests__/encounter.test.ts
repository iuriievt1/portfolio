import { ENCOUNTER_STATUS, ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { acceptsNewRecords, isEarlierDay, newRecordRefusalOf, statusAfterEmptying } from "../entities/encounter"
import { ENCOUNTER_SOURCE } from "../registry/registry-records"

const today = "2026-10-07"
const yesterday = "2026-10-06"

// CAP-014-R21, CAP-014-R29, CAP-014-R30, CAP-014-S39, CAP-014-S53
describe("whether a visit accepts a new record", () => {
	it("accepts only an open visit of today", () => {
		expect(acceptsNewRecords({ status: ENCOUNTER_STATUS.PLANNED, date: today }, today)).toBe(true)
		expect(acceptsNewRecords({ status: ENCOUNTER_STATUS.IN_PROGRESS, date: today }, today)).toBe(true)
		expect(acceptsNewRecords({ status: ENCOUNTER_STATUS.COMPLETED, date: today }, today)).toBe(false)
		expect(acceptsNewRecords({ status: ENCOUNTER_STATUS.CANCELLED, date: today }, today)).toBe(false)
		expect(acceptsNewRecords({ status: ENCOUNTER_STATUS.IN_PROGRESS, date: yesterday }, today)).toBe(false)
	})

	it("tells a visit of an earlier day by the day of the instance", () => {
		expect(isEarlierDay({ status: ENCOUNTER_STATUS.IN_PROGRESS, date: yesterday }, today)).toBe(true)
		expect(isEarlierDay({ status: ENCOUNTER_STATUS.IN_PROGRESS, date: today }, today)).toBe(false)
	})
})

// CAP-014-R07, CAP-014-S32, CAP-014-S52, CAP-014-S53
describe("why a visit refuses a new or moved record", () => {
	it("names the completed, the cancelled and the earlier visit", () => {
		expect(newRecordRefusalOf({ status: ENCOUNTER_STATUS.COMPLETED, date: today }, today)).toBe(
			ERROR_CODE.ENCOUNTER_COMPLETED,
		)
		expect(newRecordRefusalOf({ status: ENCOUNTER_STATUS.CANCELLED, date: today }, today)).toBe(
			ERROR_CODE.ENCOUNTER_CANCELLED,
		)
		expect(newRecordRefusalOf({ status: ENCOUNTER_STATUS.PLANNED, date: yesterday }, today)).toBe(
			ERROR_CODE.ENCOUNTER_NOT_TODAY,
		)
	})

	it("names the completed visit even when it is from an earlier day", () => {
		expect(newRecordRefusalOf({ status: ENCOUNTER_STATUS.COMPLETED, date: yesterday }, today)).toBe(
			ERROR_CODE.ENCOUNTER_COMPLETED,
		)
	})

	it("refuses nothing in an open visit of today", () => {
		expect(newRecordRefusalOf({ status: ENCOUNTER_STATUS.IN_PROGRESS, date: today }, today)).toBeUndefined()
	})
})

// CAP-014-R29, CAP-014-S51, CAP-014-S52
describe("the status of a visit left without records", () => {
	it("returns a worklist visit to planned", () => {
		expect(statusAfterEmptying(ENCOUNTER_SOURCE.WORKLIST)).toBe(ENCOUNTER_STATUS.PLANNED)
	})

	it("cancels a visit created in the app", () => {
		expect(statusAfterEmptying(ENCOUNTER_SOURCE.CREATED_IN_APP)).toBe(ENCOUNTER_STATUS.CANCELLED)
	})
})
