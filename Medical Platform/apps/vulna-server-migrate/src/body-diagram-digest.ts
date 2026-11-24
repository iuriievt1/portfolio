import { createHash } from "node:crypto"
import type { BodyDiagramRelease } from "@ansora/vulna-domain"

const DIGEST_ALGORITHM = "sha256"
const DIGEST_ENCODING = "hex"

// locale independent
function byLanguage([left]: [string, string], [right]: [string, string]): number {
	return left < right ? -1 : 1
}

function sortedNames(names: Readonly<Record<string, string>>): [string, string][] {
	return Object.entries(names).sort(byLanguage)
}

// CAP-016-R18, CAP-017-R09, clinical-workflow.yaml CodeListSet.body_diagram.regions
export function bodyDiagramDigest(release: BodyDiagramRelease): string {
	const regions = release.regions.map((region) => [
		region.code,
		sortedNames(region.names),
		[...region.views],
		region.isPaired,
	])
	return createHash(DIGEST_ALGORITHM).update(JSON.stringify(regions)).digest(DIGEST_ENCODING)
}
