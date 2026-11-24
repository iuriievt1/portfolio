import { DELIVERY_INSTANCE_STATE, DELIVERY_INSTANCE_STATES, DELIVERY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { assembledRecordStateOf } from "../delivery"
import { ACQUISITION_STATE } from "../entities/acquisition"

const { ASSEMBLED, ASSEMBLY_FAILED, WAITING_FOR_ASSEMBLY } = DELIVERY_STATE
const { WAITING, PENDING_VERIFICATION, CONFIRMED, PERMANENTLY_FAILED, HELD_FOR_REVIEW, CLOSED_BY_ADMINISTRATOR } =
	DELIVERY_INSTANCE_STATE
const { ASSEMBLING, DELIVERED, FAILED } = ACQUISITION_STATE

describe("the record state composed from its deliveries ✓ datovy-model.md 4 „Pořízení“", () => {
	it.each([
		["every instance is confirmed", [ASSEMBLED], [CONFIRMED, CONFIRMED], DELIVERED],
		["an instance is held for review while another is on the way", [ASSEMBLED], [HELD_FOR_REVIEW, WAITING], FAILED],
		["an instance failed for good", [ASSEMBLED], [PERMANENTLY_FAILED, CONFIRMED], FAILED],
		["the assembly failed", [ASSEMBLY_FAILED], [], FAILED],
		["only one of two failed instances is closed", [ASSEMBLED], [CLOSED_BY_ADMINISTRATOR, PERMANENTLY_FAILED], FAILED],
		[
			"a closed instance and a confirmed one",
			[ASSEMBLED],
			[CLOSED_BY_ADMINISTRATOR, CONFIRMED],
			CLOSED_BY_ADMINISTRATOR,
		],
		[
			"every instance is closed",
			[ASSEMBLED],
			[CLOSED_BY_ADMINISTRATOR, CLOSED_BY_ADMINISTRATOR],
			CLOSED_BY_ADMINISTRATOR,
		],
		[
			"a closed instance and one still verified",
			[ASSEMBLED],
			[CLOSED_BY_ADMINISTRATOR, PENDING_VERIFICATION],
			ASSEMBLING,
		],
		["a parent still waits for assembly", [ASSEMBLED, WAITING_FOR_ASSEMBLY], [CONFIRMED], ASSEMBLING],
		[
			"a closed instance while a parent still waits for assembly",
			[WAITING_FOR_ASSEMBLY],
			[CLOSED_BY_ADMINISTRATOR],
			ASSEMBLING,
		],
		["an assembled parent without instances", [ASSEMBLED], [], DELIVERED],
	] as const)("CAP-023-R09, CAP-023-R28 when %s", (_case, parents, instances, expected) => {
		expect(assembledRecordStateOf({ parents, instances })).toBe(expected)
	})

	it.each(DELIVERY_INSTANCE_STATES.filter((state) => state !== CONFIRMED))(
		"CAP-023-R09, CAP-023-R28 never reports a record with an instance in %s as delivered",
		(state) => {
			expect(assembledRecordStateOf({ parents: [ASSEMBLED], instances: [CONFIRMED, state] })).not.toBe(DELIVERED)
		},
	)
})
