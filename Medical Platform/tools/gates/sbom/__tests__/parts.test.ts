import { describe, expect, it } from "vitest"
import { type Bom, type Component, license, licenseText, newBom, npmPurl } from "../cyclonedx"
import { baseImageComponent, finishImageSbom, isNestedEntryPoint } from "../image-part"
import { packageComponent, workspaceComponent } from "../lockfile-part"

const digest = `sha256:${"b".repeat(64)}`
const product: Component = { "bom-ref": "product", type: "container", name: "Ansora Vulna Server", version: "1.0.0" }
const runtime = { name: "node", license: "MIT" }

function npm(name: string, version: string): Component {
	return {
		"bom-ref": `${npmPurl(name, version)}?package-id=1`,
		type: "library",
		name,
		version,
		purl: npmPurl(name, version),
	}
}

describe("B4 sbom parts", () => {
	it("reads a license given by its identifier, its name or an SPDX expression (CycloneDX 1.7)", () => {
		const component = (licenses: Component["licenses"]): Component => ({
			"bom-ref": "pkg:npm/pako@2.1.0",
			type: "library",
			name: "pako",
			version: "2.1.0",
			...(licenses === undefined ? {} : { licenses }),
		})

		expect(licenseText(component([{ expression: "MIT AND Zlib" }]))).toBe("MIT AND Zlib")
		expect(licenseText(component([{ license: { id: "MIT" } }, { license: { name: "Custom" } }]))).toBe("MIT Custom")
		expect(licenseText(component([{ expression: "MIT OR GPL-3.0-or-later" }]))).toMatch(/GPL/)
		expect(licenseText(component(undefined))).toBe("")
		expect(licenseText(component([{} as { license: { id: string } }]))).toBe("")
	})

	it("maps license text to an SPDX id or a name", () => {
		expect(license("MIT")).toEqual([{ license: { id: "MIT" } }])
		expect(license("(MIT OR Apache-2.0)")).toEqual([{ expression: "(MIT OR Apache-2.0)" }])
		expect(license("MIT AND Zlib")).toEqual([{ expression: "MIT AND Zlib" }])
		expect(license("SEE LICENSE IN LICENSE.md")).toEqual([{ license: { name: "SEE LICENSE IN LICENSE.md" } }])
		expect(license({ type: "ISC" })).toEqual([{ license: { id: "ISC" } }])
		expect(license(undefined)).toEqual([])
	})

	it("recognises a subpath package.json as a nested entry point", () => {
		expect(isNestedEntryPoint({ ...npm("rxjs/ajax", "UNKNOWN"), purl: "pkg:npm/rxjs/ajax" })).toBe(true)
		expect(isNestedEntryPoint(npm("@ansora/contracts", "0.0.0"))).toBe(false)
		expect(isNestedEntryPoint(npm("rxjs", "7.8.2"))).toBe(false)
	})

	it("describes the base image by digest with an oci purl", () => {
		const base = baseImageComponent("gcr.io/distroless/nodejs24-debian13", digest, "Apache-2.0")
		expect(base.version).toBe(digest)
		expect(base.licenses).toEqual([{ license: { id: "Apache-2.0" } }])
		expect(base.purl).toBe(
			`pkg:oci/nodejs24-debian13@sha256%3A${"b".repeat(64)}?repository_url=gcr.io/distroless/nodejs24-debian13`,
		)
	})

	it("drops nested entry points with their dependency edges and marks workspace packages", () => {
		const nested = { ...npm("rxjs/ajax", "UNKNOWN"), purl: "pkg:npm/rxjs/ajax" }
		const bom: Bom = {
			...newBom(product, [], [npm("rxjs", "7.8.2"), nested, npm("@ansora/contracts", "0.0.0")], new Date(0)),
			dependencies: [
				{ ref: nested["bom-ref"], dependsOn: [] },
				{ ref: npm("rxjs", "7.8.2")["bom-ref"], dependsOn: [nested["bom-ref"]] },
			],
		}
		const finished = finishImageSbom(
			bom,
			baseImageComponent("gcr.io/distroless/nodejs24-debian13", digest, "Apache-2.0"),
			runtime,
		)
		expect(finished.components.map((component) => component.name)).toEqual([
			"rxjs",
			"@ansora/contracts",
			"gcr.io/distroless/nodejs24-debian13",
		])
		expect(finished.components[1]?.supplier).toEqual({ name: "veevoy" })
		expect(finished.dependencies).toEqual([{ ref: npm("rxjs", "7.8.2")["bom-ref"], dependsOn: [] }])
		expect(finished.metadata.component.manufacturer).toEqual({ name: "veevoy" })
	})

	it("gives the runtime its license when the generator found none", () => {
		const node: Component = { "bom-ref": "node", type: "application", name: "node", version: "24.21.0" }
		const finished = finishImageSbom(newBom(product, [], [node], new Date(0)), undefined, runtime)
		expect(finished.components[0]?.licenses).toEqual([{ license: { id: "MIT" } }])
	})

	it("builds npm components with the license from the virtual store", () => {
		const component = packageComponent("@scope/name@1.2.3", new Map([["@scope/name@1.2.3", { license: "MIT" }]]))
		expect(component.purl).toBe("pkg:npm/%40scope/name@1.2.3")
		expect(component.licenses).toEqual([{ license: { id: "MIT" } }])
		expect(packageComponent("left-pad@1.0.0", new Map()).licenses).toBeUndefined()
	})

	it("builds workspace components supplied by veevoy", () => {
		const component = workspaceComponent({ name: "@ansora/mobile", version: "0.0.0", license: "UNLICENSED" })
		expect(component.supplier).toEqual({ name: "veevoy" })
		expect(component.licenses).toEqual([{ license: { id: "UNLICENSED" } }])
	})
})
