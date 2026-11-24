import { ADMINISTERED_ACQUISITION_STATES, DELIVERY_INSTANCE_STATES } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	closedAtText,
	configurationVersionText,
	fileCountText,
	pacsStatusText,
	patientText,
	startedAtText,
	stateText,
} from "@/features/acquisitions/lib/acquisition-text"
import type { AdministeredAcquisition } from "@/features/acquisitions/types/acquisition.types"
import cs from "@/i18n/cs.json"

const ACQUISITION: AdministeredAcquisition = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	kind: "photo",
	state: "delivered",
	file_count: 3,
	started_at: "2026-10-20T08:00:00.000Z",
	closed_at: "2026-10-20T08:05:00.000Z",
	configuration_version: {
		version: 4,
		created_at: "2026-10-01T07:00:00.000Z",
		author_user_id: null,
		reason: "Mez stránek dokumentu",
	},
	patient_identifiers: [{ system: "urn:oid:2.25.1", value: "8001011234" }],
	study_instance_uid: "2.25.1111",
}

describe("texts of an acquisition in the administration CAP-004-R10", () => {
	it("names every state and every PACS status in Czech", () => {
		expect(ADMINISTERED_ACQUISITION_STATES.every((state) => stateText(state).length > 0)).toBe(true)
		expect(DELIVERY_INSTANCE_STATES.every((status) => pacsStatusText(status).length > 0)).toBe(true)
	})

	it("CAP-004-S02 shows the patient by the value of the first identifier", () => {
		expect(patientText(ACQUISITION)).toBe("8001011234")
		expect(patientText({ ...ACQUISITION, patient_identifiers: [] })).toBe(cs.common.notStated)
	})

	it("CAP-012-R19 shows the configuration version with its reason", () => {
		expect(configurationVersionText(ACQUISITION)).toContain("Mez stránek dokumentu")
		expect(configurationVersionText({ ...ACQUISITION, configuration_version: undefined })).toBe(cs.common.notStated)
	})

	it("shows not stated for a file count or a start the server leaves out", () => {
		expect(fileCountText(ACQUISITION)).toBe("3")
		expect(fileCountText({ ...ACQUISITION, file_count: undefined })).toBe(cs.common.notStated)
		expect(startedAtText({ ...ACQUISITION, started_at: undefined })).toBe(cs.common.notStated)
		expect(startedAtText(ACQUISITION)).not.toBe(cs.common.notStated)
	})

	it("says a draft is not closed yet", () => {
		expect(closedAtText({ ...ACQUISITION, state: "draft", closed_at: null })).toBe(cs.acquisitions.notClosed)
		expect(closedAtText(ACQUISITION)).not.toBe(cs.acquisitions.notClosed)
	})
})
