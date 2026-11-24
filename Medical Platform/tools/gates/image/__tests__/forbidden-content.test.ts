import { describe, expect, it } from "vitest"
import { findForbidden } from "../forbidden-content"

describe("B11 forbidden content", () => {
	it("passes a distroless file list", () => {
		expect(findForbidden(["/nodejs/bin/node", "/app/apps/vulna-server-api/dist/main.js", "/etc/passwd"])).toEqual([])
	})

	it("fails on a shell, a package manager or a compiler", () => {
		expect(findForbidden(["/bin/sh"])).toHaveLength(1)
		expect(findForbidden(["/usr/bin/apt-get"])).toHaveLength(1)
		expect(findForbidden(["/nodejs/bin/npm"])).toHaveLength(1)
		expect(findForbidden(["/usr/bin/gcc"])).toHaveLength(1)
		expect(findForbidden(["/usr/bin/python3.13"])).toHaveLength(1)
	})

	it("ignores same names outside binary directories", () => {
		expect(findForbidden(["/app/node_modules/.pnpm/x/as", "/app/libs/cc"])).toEqual([])
	})
})
