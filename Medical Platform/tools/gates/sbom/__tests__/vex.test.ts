import { describe, expect, it } from "vitest"
import { type Component, newBom, npmPurl } from "../cyclonedx"
import { checkVex } from "../vex"

const product: Component = { "bom-ref": "product", type: "container", name: "Ansora Vulna Server", version: "1.0.0" }
const rxjs: Component = {
	"bom-ref": `${npmPurl("rxjs", "7.8.2")}?package-id=1`,
	type: "library",
	name: "rxjs",
	version: "7.8.2",
	purl: npmPurl("rxjs", "7.8.2"),
}
const image = newBom(product, [], [rxjs], new Date(0))

describe("B6 vex", () => {
	it("passes a statement about a component absent from the image", () => {
		const vex = { vulnerabilities: [{ id: "CVE-2026-0001", affects: [{ ref: "pkg:npm/lodash@4.17.21" }] }] }
		expect(checkVex(vex, image)).toEqual([])
	})

	it("CAP-029-S03 fails a statement about a component present in the image", () => {
		const vex = { vulnerabilities: [{ id: "CVE-2026-0002", affects: [{ ref: "pkg:npm/rxjs@7.8.2" }] }] }
		expect(checkVex(vex, image)).toEqual([
			{
				gate: "B6",
				what: "CVE-2026-0002 pkg:npm/rxjs@7.8.2",
				reason: "VEX statement about a component present in the image; the notification duty remains",
			},
		])
	})

	it("matches a statement by bom-ref as well", () => {
		const vex = { vulnerabilities: [{ id: "CVE-2026-0003", affects: [{ ref: rxjs["bom-ref"] }] }] }
		expect(checkVex(vex, image)).toHaveLength(1)
	})
})
