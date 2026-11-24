import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import type { StoredBinary } from "@ansora/core-server/ports"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LocalBinaryStore } from "../index"

const statFailure = vi.hoisted(() => ({ error: undefined as Error | undefined }))

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>()
	return {
		...actual,
		stat: async (...args: Parameters<typeof actual.stat>) => {
			if (statFailure.error !== undefined) {
				throw statFailure.error
			}
			return await actual.stat(...args)
		},
	}
})

describe("BinaryStore over the server's own storage ✓ ADR-003 ř. 31", () => {
	let root: string
	let store: LocalBinaryStore

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "vulna-binary-"))
		store = new LocalBinaryStore(root)
	})

	afterEach(async () => {
		statFailure.error = undefined
		await rm(root, { recursive: true, force: true })
	})

	it("stores and reads back bytes", async () => {
		await store.put("acquisition/a/image-1.jpg", Readable.from(["bytes"]))
		expect(await store.exists("acquisition/a/image-1.jpg")).toBe(true)
		expect(await readFile(join(root, "acquisition/a/image-1.jpg"), "utf8")).toBe("bytes")
	})

	it("deletes what it stored — the retention job ✓ CAP-026", async () => {
		await store.put("to-delete", Readable.from(["x"]))
		await store.delete("to-delete")
		expect(await store.exists("to-delete")).toBe(false)
	})

	it("does not fail when deleting a key that never existed", async () => {
		await expect(store.delete("never-existed")).resolves.toBeUndefined()
	})

	it("rejects a key that escapes the root directory", async () => {
		await expect(store.put("../outside", Readable.from(["x"]))).rejects.toThrow(/escapes the root directory/)
	})

	it("CAP-021-R35 answers a key under a file as missing", async () => {
		await store.put("file", Readable.from(["x"]))
		expect(await store.exists("file/below")).toBe(false)
	})

	it("CAP-021-R35 reports a storage it cannot read instead of answering missing", async () => {
		statFailure.error = Object.assign(new Error("i/o error"), { code: "EIO" })

		await expect(store.exists("file")).rejects.toThrow("i/o error")
	})

	it("rejects an absolute key instead of silently remapping it", async () => {
		await expect(store.exists("/etc/passwd")).rejects.toThrow(/escapes the root directory/)
	})

	it("CAP-026-R14 lists the stored bytes with their size and time of storing", async () => {
		const storedAt = new Date("2026-11-10T08:00:00.000Z")
		await store.put("first", Readable.from(["abc"]))
		await store.put("second", Readable.from(["defgh"]))
		await utimes(join(root, "first"), storedAt, storedAt)

		const listed = await listedOf(store)

		expect(listed.map((stored) => [stored.key, stored.sizeBytes]).sort()).toEqual([
			["first", 3],
			["second", 5],
		])
		expect(listed.find((stored) => stored.key === "first")?.storedAt).toEqual(storedAt)
	})

	it("CAP-026-R14 lists no directory as stored bytes", async () => {
		await mkdir(join(root, "lost+found"))
		await store.put("bytes", Readable.from(["x"]))

		expect((await listedOf(store)).map((stored) => stored.key)).toEqual(["bytes"])
	})

	it("CAP-026-R14 lists nothing before anything was stored", async () => {
		await rm(root, { recursive: true, force: true })

		expect(await listedOf(store)).toEqual([])
	})

	it("CAP-026-R14 reports a storage it cannot list instead of listing nothing", async () => {
		await rm(root, { recursive: true, force: true })
		await writeFile(root, "not a directory")

		await expect(listedOf(store)).rejects.toThrow(/ENOTDIR|not a directory/)
	})
})

async function listedOf(store: LocalBinaryStore): Promise<StoredBinary[]> {
	const listed: StoredBinary[] = []
	for await (const stored of store.list()) {
		listed.push(stored)
	}
	return listed
}
