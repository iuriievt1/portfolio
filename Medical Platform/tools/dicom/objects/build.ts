import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { StoredVariant } from "@ansora/vulna-adapter-dicom-dimse"
import { EDIT_KIND } from "@ansora/vulna-domain"
import {
	BLANK_PAGE,
	documentArtifact,
	imageArtifact,
	LONG_DESCRIPTION,
	scanPage,
	sitesOfEveryRegion,
	TABBED_DESCRIPTION,
	TEXT_PAGE,
	withMetadataAndTrailer,
} from "./synthetic-objects"

// ADR-017, Q-028, Q-040, integrace-dicom.md 5, 11, 11.3

const IMAGE_PREFIX = "image-"
const DOCUMENT_PREFIX = "document-"

function objectsOf(): [string, StoredVariant | undefined][] {
	const blankPage = scanPage(BLANK_PAGE)
	const textPage = scanPage(TEXT_PAGE)
	const sites = sitesOfEveryRegion()
	const first = sites[0]?.site
	if (first === undefined) {
		throw new Error("the current body diagram has no drawn region")
	}
	const imageOf = (...change: Parameters<typeof imageArtifact>) => imageArtifact(...change).variants[0]
	const [explicit, implicit] = documentArtifact().variants
	return [
		...sites.map(({ name, site }): [string, StoredVariant | undefined] => [
			`${IMAGE_PREFIX}${name}`,
			imageOf(site, blankPage),
		]),
		[`${IMAGE_PREFIX}text-cs`, imageOf(first, textPage)],
		[`${IMAGE_PREFIX}text-en`, imageOf(first, textPage, { language: "en" })],
		[`${IMAGE_PREFIX}derived`, imageOf(first, textPage, { editKind: EDIT_KIND.ROTATION_AND_CROP })],
		[`${IMAGE_PREFIX}long-description`, imageOf(first, textPage, { description: LONG_DESCRIPTION })],
		[`${IMAGE_PREFIX}tab`, imageOf(first, textPage, { description: TABBED_DESCRIPTION })],
		[`${IMAGE_PREFIX}metadata-and-trailer`, imageOf(first, withMetadataAndTrailer(textPage))],
		[`${DOCUMENT_PREFIX}explicit`, explicit],
		[`${DOCUMENT_PREFIX}implicit`, implicit],
	]
}

function main(): void {
	const output = process.argv[2]
	if (output === undefined) {
		throw new Error("usage: build.js <output directory>")
	}
	mkdirSync(output, { recursive: true })
	const objects = objectsOf()
	for (const [name, variant] of objects) {
		if (variant === undefined) {
			throw new Error(`the builder made no variant for ${name}`)
		}
		writeFileSync(join(output, `${name}.dcm`), variant.part10, { flag: "wx" })
	}
	const count = (prefix: string) => objects.filter(([name]) => name.startsWith(prefix)).length
	process.stdout.write(
		`${JSON.stringify({ event: "builder-objects-written", images: count(IMAGE_PREFIX), documents: count(DOCUMENT_PREFIX) })}\n`,
	)
}

main()
