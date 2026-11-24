import { describe, expect, it } from "vitest"
import { checkOwnExecutables, ownExecutableComponents } from "../own-executables"

const SANDBOX = "/usr/local/bin/ocr-sandbox"

describe("B8 own executables", () => {
	it("ADR-005 names the sandbox as a component of veevoy at the version of the release", () => {
		expect(ownExecutableComponents("1.0.0", "UNLICENSED")).toEqual([
			{
				"bom-ref": "pkg:generic/veevoy/ocr-sandbox@1.0.0",
				type: "application",
				name: "ocr-sandbox",
				version: "1.0.0",
				purl: "pkg:generic/veevoy/ocr-sandbox@1.0.0",
				supplier: { name: "veevoy" },
				licenses: [{ license: { name: "UNLICENSED" } }],
				properties: [{ name: "syft:location:0:path", value: SANDBOX }],
			},
		])
	})

	it("ADR-005 passes an image that carries the sandbox", () => {
		expect(checkOwnExecutables(new Set([SANDBOX]))).toEqual([])
	})

	it("CAP-029-S02 fails an image without the sandbox", () => {
		expect(checkOwnExecutables(new Set(["/usr/local/bin/tesseract"]))).toEqual([
			{ gate: "B8", what: SANDBOX, reason: "own executable missing from the image" },
		])
	})
})
