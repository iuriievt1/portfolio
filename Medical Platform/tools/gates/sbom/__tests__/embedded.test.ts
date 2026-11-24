import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { type Bom, type Component, newBom, npmPurl } from "../cyclonedx"
import { checkEmbeddedComponents, type EmbeddedComponent, embeddedComponents } from "../embedded"
import { MOBILE_EMBEDDED } from "../mobile"

const ROOT = join(__dirname, "../../../..")
const CARRIER = "react-native-nitro-zxing"
const CARRIER_VERSION = "0.1.0-alpha.0"
const SOURCE_SHA256 = "a".repeat(64)
const CMAKE_PROJECT_VERSION = /^project \(ZXing VERSION "([^"]+)"\)$/m
const SQLITE_CARRIER = "expo-sqlite"
const SQLCIPHER_AMALGAMATION = "vendor/sqlcipher/sqlite3.c"
const SQLCIPHER_VERSION = /^#define CIPHER_VERSION_NUMBER (\S+)$/m
const SQLITE_VERSION = /^#define SQLITE_VERSION\s+"([^"]+)"$/m

const zxing: EmbeddedComponent = {
	name: "zxing-cpp",
	version: "3.1.1",
	purl: "pkg:github/zxing-cpp/zxing-cpp@v3.1.1",
	cpe: "cpe:2.3:a:zxing-cpp:zxing-cpp:3.1.1:*:*:*:*:*:*:*",
	license: "Apache-2.0",
	source: "https://github.com/zxing-cpp/zxing-cpp/archive/refs/tags/v3.1.1.tar.gz",
	source_sha256: SOURCE_SHA256,
	package: CARRIER,
	package_version: CARRIER_VERSION,
	path: "cpp/zxing-core",
}

function mobileBom(components: Component[]): Bom {
	const product: Component = { "bom-ref": "mobile", type: "application", name: "mobile", version: "1" }
	return newBom(product, [], components, new Date(0))
}

const carrier: Component = {
	"bom-ref": npmPurl(CARRIER, CARRIER_VERSION),
	type: "library",
	name: CARRIER,
	version: CARRIER_VERSION,
	purl: npmPurl(CARRIER, CARRIER_VERSION),
}
const installed = (): boolean => true

describe("B5 components embedded in packages of the mobile app ✓ NAB-662, vydani-sbom-a-brany.md 4.2", () => {
	it("records the embedded library with its license, release and place in the carrying package", () => {
		expect(embeddedComponents([zxing])).toEqual([
			{
				"bom-ref": "pkg:github/zxing-cpp/zxing-cpp@v3.1.1",
				type: "library",
				name: "zxing-cpp",
				version: "3.1.1",
				purl: "pkg:github/zxing-cpp/zxing-cpp@v3.1.1",
				cpe: "cpe:2.3:a:zxing-cpp:zxing-cpp:3.1.1:*:*:*:*:*:*:*",
				licenses: [{ license: { id: "Apache-2.0" } }],
				evidence: { occurrences: [{ location: "react-native-nitro-zxing/cpp/zxing-core" }] },
				externalReferences: [
					{ type: "source-distribution", url: zxing.source, hashes: [{ alg: "SHA-256", content: SOURCE_SHA256 }] },
				],
			},
		])
		expect(checkEmbeddedComponents([zxing], mobileBom([carrier]), installed)).toEqual([])
	})

	it("CAP-029-S02 fails an entry without its license and leaves it out of the SBOM", () => {
		const { license: _license, ...unlicensed } = zxing

		expect(embeddedComponents([unlicensed])).toEqual([])
		expect(checkEmbeddedComponents([unlicensed], mobileBom([carrier]), installed)).toEqual([
			{
				gate: "B5",
				what: "zxing-cpp@3.1.1",
				reason: "embedded component entry without purl, cpe, license, source or hash",
			},
		])
	})

	it("CAP-029-S02 fails an entry whose carrying package is in another version or not installed", () => {
		const upgraded = { ...carrier, version: "0.2.0" }

		expect(checkEmbeddedComponents([zxing], mobileBom([upgraded]), installed)).toEqual([
			{
				gate: "B5",
				what: "zxing-cpp@3.1.1",
				reason: "package react-native-nitro-zxing@0.1.0-alpha.0 carrying it is missing from the SBOM",
			},
		])
		expect(checkEmbeddedComponents([zxing], mobileBom([carrier]), () => false)).toEqual([
			{ gate: "B5", what: "zxing-cpp@3.1.1", reason: "react-native-nitro-zxing/cpp/zxing-core is not installed" },
		])
	})

	it("keeps the recorded zxing-cpp equal to the sources the installed package carries", () => {
		const entries = JSON.parse(readFileSync(join(ROOT, MOBILE_EMBEDDED), "utf8")) as EmbeddedComponent[]
		const recorded = entries.find((entry) => entry.package === CARRIER)
		const installedCarrier = join(ROOT, "node_modules", CARRIER)
		const manifest = JSON.parse(readFileSync(join(installedCarrier, "package.json"), "utf8")) as { version: string }
		const cmake = readFileSync(join(installedCarrier, "cpp/zxing-core/core/CMakeLists.txt"), "utf8")

		expect(recorded).toMatchObject({
			package_version: manifest.version,
			version: CMAKE_PROJECT_VERSION.exec(cmake)?.[1],
		})
	})

	it("keeps the recorded SQLCipher and SQLite equal to the sources the installed expo-sqlite carries ✓ ADR-014", () => {
		const entries = JSON.parse(readFileSync(join(ROOT, MOBILE_EMBEDDED), "utf8")) as EmbeddedComponent[]
		const installedCarrier = join(ROOT, "node_modules", SQLITE_CARRIER)
		const manifest = JSON.parse(readFileSync(join(installedCarrier, "package.json"), "utf8")) as { version: string }
		const amalgamation = readFileSync(join(installedCarrier, SQLCIPHER_AMALGAMATION), "utf8")
		const recordedEntryOf = (name: string) =>
			entries.find((entry) => entry.package === SQLITE_CARRIER && entry.name === name)

		expect(recordedEntryOf("sqlcipher")).toMatchObject({
			package_version: manifest.version,
			version: SQLCIPHER_VERSION.exec(amalgamation)?.[1],
		})
		expect(recordedEntryOf("sqlite")).toMatchObject({
			package_version: manifest.version,
			version: SQLITE_VERSION.exec(amalgamation)?.[1],
		})
	})
})
