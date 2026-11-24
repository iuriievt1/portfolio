import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const CORE = join(__dirname, "../../../../libs/core/mobile/src")
const SCHEMA = readFileSync(join(__dirname, "../with-managed-configuration.js"), "utf8")

/** Read as text, not imported: the kit pulls native modules a test runner cannot load. */
function keysOf(source: string): string[] {
	return [...readFileSync(source, "utf8").matchAll(/: "([a-z_]+)",/g)].map((match) => match[1])
}

const READ_BY_APP = [
	...keysOf(join(CORE, "configuration/bootstrap.ts")),
	...keysOf(join(CORE, "configuration/pinning.ts")),
	...keysOf(join(CORE, "device/managed-enrolment.ts")),
]

const DECLARED = [...SCHEMA.matchAll(/\bkey: "([a-z_]+)"/g)].map((match) => match[1])

describe("managed configuration schema", () => {
	it("CAP-006-S02 offers the administrator every key the app reads", () => {
		expect(READ_BY_APP).not.toHaveLength(0)
		for (const key of READ_BY_APP) {
			expect(DECLARED, `the schema is missing ${key}`).toContain(key)
		}
	})

	it("CAP-006-S02 offers nothing the app never reads", () => {
		expect(DECLARED).not.toHaveLength(0)
		for (const key of DECLARED) {
			expect(READ_BY_APP, `the schema offers ${key}, which the app never reads`).toContain(key)
		}
	})
})
