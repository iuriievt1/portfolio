import { resolve } from "node:path"
import { PERMISSIONS } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { catalogFindings, readMigrations } from "../permissions/permission-catalog"

const MIGRATIONS_DIRECTORY = resolve(__dirname, "../../../db/migrations")
const CATALOG = ["users.manage", "devices.manage"]

const LIMITED = `CREATE TABLE role_permission (
	permission text NOT NULL CHECK (permission IN ('users.manage', 'devices.manage'))
);
INSERT INTO role_permission (role_code, permission) VALUES
	('administrator', 'users.manage'),
	('administrator', 'devices.manage');`

describe("permission catalog", () => {
	it("lets the database hold exactly the permissions of the code catalog", () => {
		expect(catalogFindings(PERMISSIONS, readMigrations(MIGRATIONS_DIRECTORY))).toEqual([])
	})

	it("accepts migrations that match the catalog", () => {
		expect(catalogFindings(CATALOG, [LIMITED])).toEqual([])
	})

	it("refuses a database list with a permission the catalog does not know", () => {
		const widened = `ALTER TABLE role_permission ADD CONSTRAINT role_permission_permission_check
			CHECK (permission IN ('users.manage', 'devices.manage', 'audit.delete'));`
		expect(catalogFindings(CATALOG, [LIMITED, widened])).toEqual([
			"the database allows audit.delete, which the catalog does not know",
		])
	})

	it("refuses a catalog permission the database does not allow", () => {
		expect(catalogFindings([...CATALOG, "configuration.manage"], [LIMITED])).toEqual([
			"the catalog has configuration.manage, which the database does not allow",
		])
	})

	it("refuses a seed with a permission the catalog does not know", () => {
		const seeded = "INSERT INTO role_permission (role_code, permission) VALUES ('clinician', 'audit.delete');"
		expect(catalogFindings(CATALOG, [LIMITED, seeded])).toEqual([
			"a migration seeds audit.delete, which the catalog does not know",
		])
	})

	it("refuses migrations that never limit the permissions", () => {
		expect(catalogFindings(CATALOG, [])).toEqual(["no migration limits role_permission.permission to the catalog"])
	})
})
