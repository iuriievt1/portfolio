import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const DEMO_DIRECTORY = resolve(__dirname, "assets")
const THUMBNAIL_DIRECTORY = "thumbnails"

export const ASSET_KIND = {
	WOUND: "wounds",
	PAGE: "pages",
} as const

export type AssetKind = (typeof ASSET_KIND)[keyof typeof ASSET_KIND]

export interface AssetBytes {
	original: Buffer
	thumbnail: Buffer
}

async function readRequired(path: string): Promise<Buffer> {
	if (!existsSync(path)) {
		throw new Error(`The synthetic demo asset ${path} is missing`)
	}
	return await readFile(path)
}

// ADR-026, quality/data/synteticka-sada
export async function readAsset(kind: AssetKind, name: string): Promise<AssetBytes> {
	return {
		original: await readRequired(join(DEMO_DIRECTORY, kind, name)),
		thumbnail: await readRequired(join(DEMO_DIRECTORY, THUMBNAIL_DIRECTORY, name)),
	}
}
