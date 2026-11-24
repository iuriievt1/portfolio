import { join } from "node:path"
import { readJson } from "../image/json"
import { type Bom, MANUFACTURER, newBom, type Tool } from "./cyclonedx"
import { type EmbeddedComponent, embeddedComponents } from "./embedded"
import type { Lockfile } from "./lockfile"
import {
	PRODUCT_MOBILE,
	packageComponent,
	type WorkspaceManifest,
	workspaceClosure,
	workspaceComponent,
} from "./lockfile-part"
import type { Store } from "./store"

export const MOBILE_IMPORTER = "apps/vulna-mobile"
export const MOBILE_EMBEDDED = "quality/vydani/sbom-mobile-embedded.json"

export function buildMobileBom(
	root: string,
	lockfile: Lockfile,
	store: Store,
	version: string,
	generator: Tool,
	now: Date,
): Bom {
	const closure = workspaceClosure(lockfile, MOBILE_IMPORTER, store)
	const components = [
		...[...closure.importers].map((path) =>
			workspaceComponent(readJson<WorkspaceManifest>(join(root, path, "package.json"))),
		),
		...[...closure.packages].sort().map((spec) => packageComponent(spec, store)),
		...embeddedComponents(readJson<EmbeddedComponent[]>(join(root, MOBILE_EMBEDDED))),
	]
	return newBom(
		{ "bom-ref": "mobile", type: "application", name: PRODUCT_MOBILE, version, manufacturer: { name: MANUFACTURER } },
		[generator],
		components,
		now,
	)
}
