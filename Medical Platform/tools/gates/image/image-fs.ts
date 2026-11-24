import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export interface ImageTree {
	root: string
	files: readonly string[]
	read(path: string): string
	dispose(): void
}

function walk(root: string, directory: string, found: string[]): void {
	for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
		const path = `${directory}/${entry.name}`
		if (entry.isDirectory() && !entry.isSymbolicLink()) {
			walk(root, path, found)
			continue
		}
		found.push(path)
	}
}

// no default command
const PLACEHOLDER_COMMAND = "/"

export function pullImage(reference: string): void {
	execFileSync("docker", ["pull", "-q", reference], { stdio: "pipe" })
}

export function exportImage(image: string): ImageTree {
	const root = mkdtempSync(join(tmpdir(), "vulna-image-"))
	const archive = join(root, "image.tar")
	const container = execFileSync("docker", ["create", image, PLACEHOLDER_COMMAND], { encoding: "utf8" }).trim()
	try {
		execFileSync("docker", ["export", "-o", archive, container])
	} finally {
		execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" })
	}
	const files = join(root, "fs")
	mkdirSync(files)
	// no device nodes
	execFileSync("tar", ["-xf", archive, "-C", files, "--exclude", "dev/*"])
	rmSync(archive)

	const found: string[] = []
	walk(files, "", found)

	return {
		root: files,
		files: found,
		read: (path) => readFileSync(join(files, path), "utf8"),
		dispose: () => rmSync(root, { recursive: true, force: true }),
	}
}
