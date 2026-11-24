import { describe, expect, it } from "vitest"
import {
	controlFindings,
	missingTableFindings,
	PERMISSION_DENIED_MESSAGE,
	privilegeFindings,
	roleFindings,
	TRIGGER_MESSAGE,
	triggerFindings,
} from "../audit-permissions/audit-permissions"

const OWNER = "owner vulna_migrate"
const API_ROLE = "role vulna_api"
const API_UPDATE = { role: "vulna_api", table: "audit", privilege: "UPDATE" }

describe("B19 audit privileges", () => {
	it("passes when no role may change the audit table", () => {
		expect(privilegeFindings([])).toEqual([])
	})

	it("CAP-025-S10 names the role, the table and the privilege a migration granted by mistake", () => {
		expect(privilegeFindings([API_UPDATE, { role: "vulna_migrate", table: "audit", privilege: "TRUNCATE" }])).toEqual([
			"role vulna_api has UPDATE on table audit",
			"role vulna_migrate has TRUNCATE on table audit",
		])
	})

	it("CAP-025-S02 passes when the database refuses every change by an application role", () => {
		const attempts = ["UPDATE", "DELETE", "TRUNCATE"].map((statement) => ({
			actor: API_ROLE,
			table: "audit",
			statement,
			failure: PERMISSION_DENIED_MESSAGE,
		}))
		expect(roleFindings(attempts)).toEqual([])
	})

	it("CAP-025-S02 fails when an application role reaches the trigger instead of a missing privilege", () => {
		expect(roleFindings([{ actor: API_ROLE, table: "audit", statement: "UPDATE", failure: TRIGGER_MESSAGE }])).toEqual([
			'role vulna_api ran UPDATE on table audit and it failed with "audit is append-only" instead of the missing privilege',
		])
	})

	it("CAP-025-S12 passes when the trigger rejects every change by the owner", () => {
		const attempts = ["UPDATE", "DELETE", "TRUNCATE"].map((statement) => ({
			actor: OWNER,
			table: "audit",
			statement,
			failure: TRIGGER_MESSAGE,
		}))
		expect(triggerFindings(attempts)).toEqual([])
	})

	it("CAP-025-S12 fails when the owner deletes a record and no trigger stops it", () => {
		expect(triggerFindings([{ actor: OWNER, table: "audit", statement: "DELETE", failure: undefined }])).toEqual([
			"owner vulna_migrate ran DELETE on table audit and no trigger stopped it",
		])
	})

	it("fails when a change by the owner stops on something other than the trigger", () => {
		expect(
			triggerFindings([{ actor: OWNER, table: "audit", statement: "UPDATE", failure: PERMISSION_DENIED_MESSAGE }]),
		).toEqual([
			'owner vulna_migrate ran UPDATE on table audit and it failed with "permission denied for table audit" instead of the trigger',
		])
	})

	it("fails when the check does not notice a privilege granted on purpose", () => {
		expect(controlFindings(API_UPDATE, [API_UPDATE])).toEqual([])
		expect(controlFindings(API_UPDATE, [])).toEqual(["the check missed UPDATE granted to vulna_api on table audit"])
	})

	it("fails when the audit table is missing after the migrations", () => {
		expect(missingTableFindings(["audit"])).toEqual([])
		expect(missingTableFindings([])).toEqual(["table audit does not exist after the migrations"])
	})
})
