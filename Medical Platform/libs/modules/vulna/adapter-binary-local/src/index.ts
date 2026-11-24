import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, opendir, rm, stat } from "node:fs/promises"
import { dirname, isAbsolute, join, resolve, sep } from "node:path"
import type { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { BinaryInventoryPort, BinaryStorePort, StoredBinary } from "@ansora/core-server/ports"

// CAP-021-R35, CAP-026-R18
const MISSING_FILE_CODES: ReadonlySet<string> = new Set(["ENOENT", "ENOTDIR"])
// CAP-026-R14
const ABSENT_FILE_CODES: ReadonlySet<string> = new Set(["ENOENT"])

function hasCodeOf(error: unknown, codes: ReadonlySet<string>): boolean {
	return error instanceof Error && "code" in error && codes.has(String(error.code))
}

function isMissingFile(error: unknown): boolean {
	return hasCodeOf(error, MISSING_FILE_CODES)
}

async function unlessAbsent<Result>(pending: Promise<Result>): Promise<Result | undefined> {
	try {
		return await pending
	} catch (error) {
		if (hasCodeOf(error, ABSENT_FILE_CODES)) {
			return undefined
		}
		throw error
	}
}

/**
 * Adapter for the BinaryStore port over the server's own storage ✓ ADR-003 ř. 31.
 *
 * An adapter knows **only its port and its manifest** ✓ ADR-003 ř. 26 — which is why it imports
 * nothing but `@ansora/core-server/ports`. It adds no image, no long-running process and no
 * listening port ✓ ADR-003 ř. 42.
 */
export class LocalBinaryStore implements BinaryStorePort, BinaryInventoryPort {
	constructor(private readonly rootDirectory: string) {}

	// CAP-026-R14, backend.md 2.1
	async *list(): AsyncIterable<StoredBinary> {
		const root = resolve(this.rootDirectory)
		const directory = await unlessAbsent(opendir(root))
		if (directory === undefined) {
			return
		}
		for await (const entry of directory) {
			if (!entry.isFile()) {
				continue
			}
			const stored = await unlessAbsent(stat(join(root, entry.name)))
			if (stored !== undefined) {
				yield { key: entry.name, sizeBytes: stored.size, storedAt: stored.mtime }
			}
		}
	}

	async put(key: string, content: Readable): Promise<void> {
		const path = this.pathFor(key)
		await mkdir(dirname(path), { recursive: true })
		await pipeline(content, createWriteStream(path))
	}

	async get(key: string): Promise<Readable> {
		return createReadStream(this.pathFor(key))
	}

	async delete(key: string): Promise<void> {
		await rm(this.pathFor(key), { force: true })
	}

	async exists(key: string): Promise<boolean> {
		// The key is validated BEFORE the try, or the catch would swallow the validation error too.
		const path = this.pathFor(key)
		try {
			await stat(path)
			return true
		} catch (error) {
			if (isMissingFile(error)) {
				return false
			}
			throw error
		}
	}

	/**
	 * A key must not escape the root directory — otherwise anything on the server's disk could
	 * be read.
	 *
	 * An absolute key is **rejected**, not remapped: `join` would silently turn `/etc/passwd`
	 * into `<root>/etc/passwd` and the caller would never learn about the bug.
	 */
	private pathFor(key: string): string {
		if (key === "" || isAbsolute(key)) {
			throw new Error(`BinaryStore key escapes the root directory: ${key}`)
		}

		const root = resolve(this.rootDirectory)
		const path = resolve(join(root, key))
		if (path !== root && !path.startsWith(root + sep)) {
			throw new Error(`BinaryStore key escapes the root directory: ${key}`)
		}
		return path
	}
}
