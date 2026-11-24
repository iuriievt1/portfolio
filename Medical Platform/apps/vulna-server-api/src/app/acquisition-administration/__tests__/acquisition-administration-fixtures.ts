import { ACQUISITION_KIND, DELIVERY_INSTANCE_STATE } from "@ansora/contracts"
import { PERMISSIONS } from "@ansora/core-server"
import { ACQUISITION_STATE } from "@ansora/vulna-domain"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { FoundPatient } from "../../registry/types/registry.types"
import type { AcquisitionInstanceRow, AdministeredAcquisitionRow } from "../types/acquisition-administration.types"

export const ADMINISTRATOR: AdministrationSession = {
	sessionId: "9e8d7c6b-5a49-4382-8170-6f5e4d3c2b1a",
	userId: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	permissions: PERMISSIONS,
}

export const PATIENT_ID = "11111111-1111-4111-8111-111111111111"
export const BIRTH_NUMBER = "8001011234"
export const BIRTH_NUMBER_SYSTEM = "urn:oid:2.25.1"
export const STUDY_INSTANCE_UID = "2.25.1111"
export const SERIES_INSTANCE_UID = "2.25.2222"
export const SOP_INSTANCE_UID = "2.25.3333"
export const SECONDARY_CAPTURE = "1.2.840.10008.5.1.4.1.1.7"

export const PATIENT: FoundPatient = {
	patient: { id: PATIENT_ID, sex: null },
	identifiers: [{ patient_id: PATIENT_ID, system: BIRTH_NUMBER_SYSTEM, value: BIRTH_NUMBER, issuer: null }],
}

export const DELIVERED: AdministeredAcquisitionRow = {
	id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	kind: ACQUISITION_KIND.PHOTO,
	state: ACQUISITION_STATE.DELIVERED,
	file_count: 3,
	operator_user_id: "22222222-2222-4222-8222-222222222222",
	closing_device_id: "33333333-3333-4333-8333-333333333333",
	patient_id: PATIENT_ID,
	encounter_id: "44444444-4444-4444-8444-444444444444",
	started_at: new Date("2026-10-20T08:00:00.000Z"),
	closed_at: new Date("2026-10-20T08:05:00.000Z"),
	configuration_version: 4,
	configuration_created_at: new Date("2026-10-01T07:00:00.000Z"),
	configuration_author_user_id: "3f0d1c2e-5b6a-4c7d-8e9f-0a1b2c3d4e5f",
	configuration_reason: "Mez stránek dokumentu",
	study_instance_uid: STUDY_INSTANCE_UID,
	series_instance_uid: SERIES_INSTANCE_UID,
	started_at_moment: "2026-10-20T08:00:00.000000Z",
}

export const DRAFT: AdministeredAcquisitionRow = {
	...DELIVERED,
	id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	kind: ACQUISITION_KIND.SCAN,
	state: ACQUISITION_STATE.DRAFT,
	file_count: null,
	closing_device_id: null,
	closed_at: null,
	series_instance_uid: null,
	started_at: new Date("2026-10-19T08:00:00.000Z"),
	started_at_moment: "2026-10-19T08:00:00.000000Z",
}

export const CONFIRMED_INSTANCE: AcquisitionInstanceRow = {
	sop_instance_uid: SOP_INSTANCE_UID,
	sop_class_uid: SECONDARY_CAPTURE,
	delivery_state: DELIVERY_INSTANCE_STATE.CONFIRMED,
}
