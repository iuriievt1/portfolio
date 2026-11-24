import { execFileSync } from "node:child_process"
import type { Finding } from "./finding"

const GATE = "B7"

export interface BaseImage {
	image: string
	digest: string | null
}

interface PlatformImage {
	rootfs?: { diff_ids?: string[] }
}

export function baseReference(base: BaseImage): string | undefined {
	return base.digest === null ? undefined : `${base.image}@${base.digest}`
}

export function imageLayers(image: string): string[] {
	return JSON.parse(
		execFileSync("docker", ["image", "inspect", image, "--format", "{{json .RootFS.Layers}}"], { encoding: "utf8" }),
	) as string[]
}

export function imagePlatform(image: string): string {
	return execFileSync("docker", ["image", "inspect", image, "--format", "{{.Os}}/{{.Architecture}}"], {
		encoding: "utf8",
	}).trim()
}

export function baseLayers(reference: string, platform: string): string[] | undefined {
	const output = execFileSync("docker", ["buildx", "imagetools", "inspect", reference, "--format", "{{json .Image}}"], {
		encoding: "utf8",
	})
	const parsed = JSON.parse(output) as PlatformImage | Record<string, PlatformImage>
	const image = "rootfs" in parsed ? (parsed as PlatformImage) : (parsed as Record<string, PlatformImage>)[platform]
	return image?.rootfs?.diff_ids
}

export function checkBaseLayers(
	base: BaseImage,
	layers: readonly string[],
	expected: readonly string[] | undefined,
): Finding[] {
	if (base.digest === null) {
		return [{ gate: GATE, what: base.image, reason: "base image without digest in the profile" }]
	}
	if (expected === undefined) {
		return [{ gate: GATE, what: base.digest, reason: "base image layers unavailable for this platform" }]
	}
	const matches = expected.length <= layers.length && expected.every((layer, index) => layers[index] === layer)
	return matches
		? []
		: [{ gate: GATE, what: base.digest, reason: "image is not built on the base image of the profile" }]
}
