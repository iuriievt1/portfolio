import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { imageReference, type ThirdPartyImage } from "../../profile/model"
import { pullImage } from "../image/image-fs"
import { runDocker } from "../image/tools"
import { type Bom, type Component, license, MANUFACTURER } from "./cyclonedx"

export const SYFT_IMAGE = "anchore/syft:v1.52.0@sha256:500e2d872ac019436926e8322b4fc1f39441d94d21f6f4046c6ff29b30e8cb02"
const PRODUCT_SERVER = "Ansora Vulna Server"
const WORKSPACE_SCOPE = "@ansora/"

export function generateImageSbom(image: string, version: string, sourceName: string = PRODUCT_SERVER): Bom {
	const directory = mkdtempSync(join(tmpdir(), "vulna-sbom-"))
	try {
		execFileSync("docker", ["save", "-o", join(directory, "image.tar"), image])
		const result = runDocker([
			"-e",
			"SYFT_FILE_METADATA_SELECTION=none",
			"-v",
			`${directory}:/scan`,
			SYFT_IMAGE,
			"scan",
			"docker-archive:/scan/image.tar",
			"--source-name",
			sourceName,
			"--source-version",
			version,
			"-o",
			"cyclonedx-json=/scan/sbom.json",
			"-q",
		])
		if (result.status !== 0) {
			throw new Error(`syft failed: ${result.output.trim().split("\n").pop()}`)
		}
		return JSON.parse(readFileSync(join(directory, "sbom.json"), "utf8")) as Bom
	} finally {
		rmSync(directory, { recursive: true, force: true })
	}
}

// subpath export
export function isNestedEntryPoint(component: Component): boolean {
	return (
		component.purl?.startsWith("pkg:npm/") === true && component.name.includes("/") && !component.name.startsWith("@")
	)
}

export interface Licensed {
	name: string
	license: string
}

export function baseImageComponent(image: string, digest: string, imageLicense: string): Component {
	const name = image.split("/").pop() as string
	return {
		"bom-ref": `pkg:oci/${name}@${digest}`,
		type: "container",
		name: image,
		version: digest,
		purl: `pkg:oci/${name}@${digest.replace(":", "%3A")}?repository_url=${image}`,
		licenses: license(imageLicense),
	}
}

function enrich(component: Component, runtime: Licensed): Component {
	if (component.name.startsWith(WORKSPACE_SCOPE)) {
		return { ...component, supplier: { name: MANUFACTURER } }
	}
	if (component.name === runtime.name && component.licenses === undefined) {
		return { ...component, licenses: license(runtime.license) }
	}
	return component
}

export function finishImageSbom(bom: Bom, base: Component | undefined, runtime: Licensed): Bom {
	const kept = bom.components.filter((component) => !isNestedEntryPoint(component))
	const refs = new Set(kept.map((component) => component["bom-ref"]))
	const components = kept.map((component) => enrich(component, runtime))
	return {
		...bom,
		metadata: {
			...bom.metadata,
			component: { ...bom.metadata.component, manufacturer: { name: MANUFACTURER } },
		},
		components: base === undefined ? components : [...components, base],
		dependencies: bom.dependencies
			?.filter((dependency) => refs.has(dependency.ref))
			.map((dependency) => ({ ...dependency, dependsOn: dependency.dependsOn?.filter((ref) => refs.has(ref)) })),
	}
}

// vydani-sbom-a-brany.md 1, CAP-029-R30
export function thirdPartyImageSbom(entry: ThirdPartyImage): Bom {
	const reference = imageReference(entry)
	pullImage(reference)
	const bom = generateImageSbom(reference, entry.version, entry.image)
	return { ...bom, components: [baseImageComponent(entry.image, entry.digest, entry.license), ...bom.components] }
}
