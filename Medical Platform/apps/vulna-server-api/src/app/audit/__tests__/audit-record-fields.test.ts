import type { JsonObject } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { AuditSearchRow } from "../types/audit.types"
import { auditRecordView } from "../utils/audit-record-view"

const USER_ID = "22222222-2222-4222-8222-222222222222"
const OBJECT_ID = "33333333-3333-4333-8333-333333333333"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const DELIVERY_ID = "44444444-4444-4444-8444-444444444444"

function row(eventType: string, details: JsonObject, objectId: string | null = OBJECT_ID): AuditSearchRow {
	return {
		id: "00000000-0000-4000-8000-000000000001",
		sequence: "1",
		occurred_at: new Date("2026-10-06T08:00:00.000Z"),
		event_type: eventType,
		actor_kind: "user",
		actor_user_id: "11111111-1111-4111-8111-111111111111",
		actor_device_id: null,
		system_job: null,
		session_id: null,
		object_id: objectId,
		source_address: null,
		outcome: "success",
		details,
		previous_hash: "",
		hash: "a".repeat(64),
		personal_number: "000102",
		display_name: "Petr Svoboda",
	}
}

describe("named fields of an audit record", () => {
	it("CAP-012-R32 carries the level, the target and the previous and new override of a login methods change", () => {
		const view = auditRecordView(
			row("login-methods-changed", {
				level: "device",
				hw_id: "hw",
				group_code: "ambulance",
				previous_login_methods: { card: true },
				login_methods: { card: false, pin: null },
			}),
		)
		expect(view).toMatchObject({
			target_device_id: OBJECT_ID,
			login_methods_change: {
				level: "device",
				group_code: "ambulance",
				previous: { card: true },
				current: { card: false },
			},
			details: null,
		})
	})

	it("CAP-023-S24 carries the record, the delivery, the instance, the reason and the note of a closed delivery", () => {
		const view = auditRecordView(
			row("delivery-closed", {
				acquisition_id: ACQUISITION_ID,
				delivery_id: DELIVERY_ID,
				delivery_instance_id: OBJECT_ID,
				closed_from_state: "held_for_review",
				reason: "wrong_patient_or_encounter",
				note: "Snímek patří jinému pacientovi.",
				administrator_user_id: "11111111-1111-4111-8111-111111111111",
			}),
		)
		expect(view).toMatchObject({
			acquisition_id: ACQUISITION_ID,
			delivery_id: DELIVERY_ID,
			delivery_instance_id: OBJECT_ID,
			reason: { code: "wrong_patient_or_encounter", text: "Snímek patří jinému pacientovi." },
		})
	})

	it("CAP-022-S06 carries the delivery, the record and the reason of a restarted text recognition", () => {
		const view = auditRecordView(
			row("text-recognition-restarted", {
				acquisition_id: ACQUISITION_ID,
				delivery_id: DELIVERY_ID,
				reason: "Nástroj OCR měl málo paměti, opraveno.",
				administrator_user_id: "11111111-1111-4111-8111-111111111111",
			}),
		)
		expect(view).toMatchObject({
			acquisition_id: ACQUISITION_ID,
			delivery_id: DELIVERY_ID,
			reason: { code: null, text: "Nástroj OCR měl málo paměti, opraveno." },
		})
	})

	it("CAP-026-S07 carries the binary object a cleanup set aside", () => {
		const view = auditRecordView(
			row("orphaned-object-set-aside", {
				binary_object_id: OBJECT_ID,
				size_bytes: 2048,
				created_at: "2026-11-10T08:00:00.000Z",
			}),
		)
		expect(view).toMatchObject({ binary_object_id: OBJECT_ID, reason: null })
	})

	it("CAP-026-S08 carries the binary object and the reason of the administrator who deleted it", () => {
		const view = auditRecordView(
			row("orphaned-object-deletion", {
				binary_object_id: OBJECT_ID,
				reason: "Zbytek po přerušeném nahrávání",
				administrator_user_id: USER_ID,
			}),
		)
		expect(view).toMatchObject({
			binary_object_id: OBJECT_ID,
			reason: { code: null, text: "Zbytek po přerušeném nahrávání" },
		})
	})

	it("CAP-012-R19 carries the version and the reason of a configuration change", () => {
		const view = auditRecordView(row("configuration-changed", { version: 4, reason: "delší PIN" }, null))
		expect(view).toMatchObject({ configuration_version: 4, reason: { code: null, text: "delší PIN" } })
	})

	it("CAP-001-R19 CAP-004-R09 carries the scope, the method and the refusal code of a login", () => {
		const view = auditRecordView(
			row("login", { scope: "administration", method: "oidc", reason: "authentication_stale" }, null),
		)
		expect(view).toMatchObject({
			scope: "administration",
			login_method: "oidc",
			reason: { code: "authentication_stale", text: null },
		})
	})

	it("CAP-003-R11 carries the user and the previous and new roles", () => {
		const view = auditRecordView(
			row("user-roles-changed", {
				origin: "manual",
				previous_roles: ["clinician"],
				roles: ["clinician", "administrator"],
			}),
		)
		expect(view).toMatchObject({
			target_user_id: OBJECT_ID,
			role_change: { origin: "manual", previous_roles: ["clinician"], roles: ["clinician", "administrator"] },
		})
	})

	it("CAP-005-R13 carries the user and the code of a personal QR code but not its content", () => {
		const view = auditRecordView(row("qr-code-issued", { user_id: USER_ID, key_version: "1" }))
		expect(view).toMatchObject({ target_user_id: USER_ID, qr_code_id: OBJECT_ID })
	})

	it("CAP-005-R03 carries the user and the binding of a revoked card", () => {
		const view = auditRecordView(row("card-revocation", { user_id: USER_ID }))
		expect(view).toMatchObject({ target_user_id: USER_ID, card_id: OBJECT_ID })
	})

	it("CAP-005-R07 names the revoked user", () => {
		const view = auditRecordView(row("user-revocation", {}, USER_ID))
		expect(view).toMatchObject({ target_user_id: USER_ID })
	})

	it("CAP-025-R22 carries the time on the device and the reported details of a local data deletion", () => {
		const reported = { reason: "device_revocation", count: 3, oldest_acquired_at: "2026-10-05T07:00:00.000Z" }
		const view = auditRecordView(
			row(
				"local-data-deletion",
				{
					originated_at: "2026-10-06T07:59:00.000Z",
					idempotency_key: "44444444-4444-4444-8444-444444444444",
					event_details: reported,
				},
				null,
			),
		)
		expect(view).toMatchObject({ originated_on_device_at: "2026-10-06T07:59:00.000Z", details: reported })
	})

	it("CAP-005-R17 carries the user and the end of validity of a card binding code", () => {
		const view = auditRecordView(
			row("card-binding-code-issued", { user_id: USER_ID, expires_at: "2026-10-06T08:10:00.000Z", note: null }),
		)
		expect(view).toMatchObject({ target_user_id: USER_ID, code_expires_at: "2026-10-06T08:10:00.000Z", reason: null })
	})

	it("CAP-006-R20 names the device and its state before a revocation", () => {
		const view = auditRecordView(row("device-revocation", { hw_id: "hw", previous_state: "pending_approval" }))
		expect(view).toMatchObject({ target_device_id: OBJECT_ID, previous_device_state: "pending_approval" })
	})

	it("CAP-008-S07 carries what the device reported with its block, its lost items and its state before", () => {
		const reported = { signals: ["root", "debugger"], detected_at: "2026-10-29T08:00:00.000Z", app_version: "1.0.0" }
		const lost = { count: 4, oldest_acquired_at: "2026-10-28T14:00:00.000Z" }
		const view = auditRecordView(
			row("device-blocking", { previous_state: "approved", ...reported, unsent_items: lost }),
		)
		expect(view).toEqual(
			expect.objectContaining({
				target_device_id: OBJECT_ID,
				previous_device_state: "approved",
				details: reported,
				lost_items: lost,
			}),
		)
	})

	it("CAP-025-R16 carries the lost items of a deletion after a modification and of no other deletion", () => {
		const lost = { count: 2, oldest_acquired_at: null }
		const deletion = (reason: string) =>
			auditRecordView(
				row("local-data-deletion", {
					originated_at: "2026-10-29T08:00:00.000Z",
					idempotency_key: "33333333-3333-4333-8333-333333333333",
					event_details: { reason, ...lost },
				}),
			)
		expect(deletion("os_modification").lost_items).toEqual(lost)
		expect(deletion("device_revocation").lost_items).toBeNull()
	})

	it("CAP-007-S07 carries the result of the review with the unblocking", () => {
		const view = auditRecordView(
			row("device-unblocking", { hw_id: "hw", previous_state: "blocked", reason: "Falešný poplach, MDM ověřeno." }),
		)
		expect(view).toMatchObject({
			target_device_id: OBJECT_ID,
			previous_device_state: "blocked",
			reason: { code: null, text: "Falešný poplach, MDM ověřeno." },
		})
	})

	it("CAP-006-R18 carries the previous and new group of a device", () => {
		const view = auditRecordView(
			row("device-assigned-to-group", { hw_id: "hw", previous_group_code: null, group_code: "ambulance" }),
		)
		expect(view).toMatchObject({
			target_device_id: OBJECT_ID,
			device_group_change: { previous_group_code: null, group_code: "ambulance" },
		})
	})

	it("NAB-442 carries the export, its step and its period", () => {
		const view = auditRecordView(
			row("audit-export", {
				stage: "requested",
				from: "2026-10-01T00:00:00.000Z",
				to: null,
				event_type: "login",
				until_sequence: 42,
			}),
		)
		expect(view.audit_export).toEqual({
			export_id: OBJECT_ID,
			stage: "requested",
			from: "2026-10-01T00:00:00.000Z",
			to: null,
			event_type: "login",
			until_sequence: 42,
		})
	})

	it("CAP-025-S04 carries the refusal code of an export without the permission", () => {
		const view = auditRecordView(row("audit-export", { stage: "requested", reason: "permission-denied" }, null))
		expect(view).toMatchObject({
			audit_export: { export_id: null, stage: "requested" },
			reason: { code: "permission-denied", text: null },
		})
	})

	it("CAP-025-S13 carries the first broken record of a failed chain check", () => {
		const view = auditRecordView(
			row("audit-chain-broken", { first_broken_record_id: OBJECT_ID, checked_until: "2026-10-06T08:00:00.000Z" }),
		)
		expect(view.audit_chain_check).toEqual({
			first_broken_record_id: OBJECT_ID,
			checked_until: "2026-10-06T08:00:00.000Z",
		})
	})

	it("CAP-025-S17 carries the search method and the found patient of a patient search", () => {
		const view = auditRecordView(row("patient-search", { search_method: "fulltext", patient_identifier: "8501011234" }))
		expect(view).toMatchObject({
			search_method: "fulltext",
			patient_identifier: "8501011234",
			patient_identifiers: null,
		})
	})

	it("CAP-025-R18 carries every released patient of a search with more matches", () => {
		const view = auditRecordView(
			row("patient-search", { search_method: "code", patient_identifiers: ["1001", "1002"] }),
		)
		expect(view).toMatchObject({
			search_method: "code",
			patient_identifier: null,
			patient_identifiers: ["1001", "1002"],
		})
	})

	it("CAP-025-S18 carries the times, the outcome and the counts of a registry sync run", () => {
		const run = {
			started_at: "2026-10-06T08:00:00.000Z",
			finished_at: "2026-10-06T08:01:00.000Z",
			outcome: "incomplete",
			patients_added: 3,
			patients_changed: 1,
			encounters_added: 5,
			encounters_changed: 0,
		}
		const view = auditRecordView(row("registry-sync-run", run))
		expect(view.registry_sync_run).toEqual(run)
	})

	it("CAP-014-R08 carries the previous and new patient and visit of a moved draft", () => {
		const change = {
			previous_patient_identifier: "000101",
			new_patient_identifier: "000202",
			previous_encounter_id: "44444444-4444-4444-8444-444444444444",
			new_encounter_id: "55555555-5555-4555-8555-555555555555",
		}
		const view = auditRecordView(
			row("draft-acquisition-assignment-changed", {
				patient_identifier: "000202",
				encounter_id: change.new_encounter_id,
				operator_user_id: USER_ID,
				assignment_change: change,
			}),
		)
		expect(view).toMatchObject({
			patient_identifier: "000202",
			encounter_id: change.new_encounter_id,
			acquisition_id: OBJECT_ID,
			operator_user_id: USER_ID,
			assignment_change: change,
		})
	})

	it("CAP-025-R26 names the author of a draft discarded by someone else", () => {
		const view = auditRecordView(row("draft-acquisition-discard", { operator_user_id: USER_ID }))
		expect(view).toMatchObject({ acquisition_id: OBJECT_ID, operator_user_id: USER_ID })
	})

	it("CAP-025-R20 carries the situation and the number of files of a draft its author discarded", () => {
		const view = auditRecordView(
			row("draft-acquisition-discard", { operator_user_id: USER_ID, situation: "logout", discarded_file_count: 3 }),
		)
		expect(view).toMatchObject({
			discard_situation: "logout",
			discarded_file_count: 3,
			draft_discard_consent_id: null,
			reason: null,
		})
	})

	it("CAP-025-R20 leaves out a situation it does not know and a count that is not a whole number", () => {
		const view = auditRecordView(
			row("draft-acquisition-discard", { situation: "session_end", discarded_file_count: "3" }),
		)
		expect(view).toMatchObject({ discard_situation: null, discarded_file_count: null })
	})

	it("CAP-025-R29 carries the previous and new status of an emptied visit and the act that emptied it", () => {
		const emptying = { previous_status: "in_progress", new_status: "cancelled", emptied_by: "encounter_cancellation" }
		const view = auditRecordView(
			row("encounter-emptied", { patient_identifier: "000101", encounter_emptying: emptying }),
		)
		expect(view).toMatchObject({ patient_identifier: "000101", encounter_id: OBJECT_ID, encounter_emptying: emptying })
	})

	it("CAP-025-R27 carries the refused act and its code", () => {
		const view = auditRecordView(
			row("encounter-action-rejected", { encounter_action: "cancel", reason: "encounter-has-closed-record" }),
		)
		expect(view).toMatchObject({
			encounter_action: "cancel",
			reason: { code: "encounter-has-closed-record", text: null },
		})
	})

	it("CAP-025-R30 carries the patient, the record and the refused wound type of a finding", () => {
		const change = {
			finding_id: OBJECT_ID,
			previous_wound_type_code: "pressure-ulcer",
			wound_type_code: "leg-ulcer",
			code_list_version: "3",
		}
		const view = auditRecordView(
			row("finding-wound-type-changed", {
				patient_identifier: "000101",
				acquisition_id: "44444444-4444-4444-8444-444444444444",
				reason: "wound-type-locked",
				wound_type_change: change,
			}),
		)
		expect(view).toMatchObject({
			patient_identifier: "000101",
			acquisition_id: "44444444-4444-4444-8444-444444444444",
			reason: { code: "wound-type-locked", text: null },
			wound_type_change: change,
		})
	})

	it("CAP-021-S25 names the user whose clinical record write the administrator requeued", () => {
		const actor = auditRecordView(row("clinical-record-write-requeued", { object_kind: "actor", object_id: USER_ID }))
		const codeLists = auditRecordView(
			row("clinical-record-write-requeued", { object_kind: "code_list_set", object_id: USER_ID }),
		)
		expect(actor.target_user_id).toBe(USER_ID)
		expect(codeLists.target_user_id).toBeNull()
	})

	it("CAP-015-S18 carries the consent and its reason of a draft discarded with the administrator consent", () => {
		const consentId = "44444444-4444-4444-8444-444444444444"
		const discard = auditRecordView(
			row("draft-acquisition-discard", {
				operator_user_id: USER_ID,
				draft_discard_consent_id: consentId,
				reason: "operator_revoked",
				situation: "administrator_consent",
				discarded_file_count: 2,
			}),
		)
		const consent = auditRecordView(
			row("draft-discard-consent-granted", {
				operator_user_id: USER_ID,
				draft_discard_consent_id: consentId,
				reason: "operator_revoked",
			}),
		)
		expect(discard).toMatchObject({
			operator_user_id: USER_ID,
			draft_discard_consent_id: consentId,
			reason: { code: "operator_revoked", text: null },
			discard_situation: "administrator_consent",
			discarded_file_count: 2,
		})
		expect(consent).toMatchObject({
			operator_user_id: USER_ID,
			draft_discard_consent_id: consentId,
			reason: { code: "operator_revoked", text: null },
		})
	})

	it("CAP-004-R14 carries the filter, the count and the patients of the draft list an administrator viewed", () => {
		const view = auditRecordView(
			row(
				"acquisition-drafts-viewed",
				{ operator_user_id: USER_ID, released_item_count: 2, patient_identifiers: ["8001011234", "7502023456"] },
				null,
			),
		)
		expect(view).toMatchObject({
			operator_user_id: USER_ID,
			released_item_count: 2,
			patient_identifiers: ["8001011234", "7502023456"],
		})
	})

	it("CAP-004-R10 carries the count and the patients of the acquisition list an administrator viewed", () => {
		const view = auditRecordView(
			row("acquisitions-viewed", { released_item_count: 2, patient_identifiers: ["8001011234", "7502023456"] }, null),
		)
		expect(view).toMatchObject({
			released_item_count: 2,
			patient_identifiers: ["8001011234", "7502023456"],
		})
	})

	it("drops a stored value the contract does not know", () => {
		const view = auditRecordView(
			row("user-roles-changed", { origin: "manual", previous_roles: ["clinician", "auditor"], roles: [] }),
		)
		expect(view.role_change).toEqual({ origin: "manual", previous_roles: ["clinician"], roles: [] })
	})
})
