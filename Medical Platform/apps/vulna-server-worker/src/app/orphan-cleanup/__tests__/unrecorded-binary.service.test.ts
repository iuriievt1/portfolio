import { createHash, randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { StoredBinary } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { BufferStore } from "../../../libs/binary-store/binary-store.types"
import { ORPHAN_CLEANUP_BATCH_SIZE } from "../constants/orphan-cleanup.constants"
import type { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import { UnrecordedBinaryService } from "../services/unrecorded-binary.service"

const CUTOFF = new Date("2026-11-10T12:00:00.000Z")
const BEFORE_CUTOFF = new Date("2026-11-09T12:00:00.000Z")
const UNREADABLE = "unreadable bytes"

interface Listing {
	store: BufferStore
	listedCount: () => number
}

function bytesOf(key: string): Buffer {
	return Buffer.from(`bytes of ${key}`)
}

function listingOf(binaries: readonly StoredBinary[], unreadable: ReadonlySet<string> = new Set()): Listing {
	let listedCount = 0
	const store = {
		async *list(): AsyncIterable<StoredBinary> {
			for (const binary of binaries) {
				listedCount += 1
				yield binary
			}
		},
		async get(key: string): Promise<Readable> {
			if (unreadable.has(key)) {
				throw new Error(UNREADABLE)
			}
			return Readable.from([bytesOf(key)])
		},
	} as unknown as BufferStore
	return { store, listedCount: () => listedCount }
}

function recordedAmong(recorded: ReadonlySet<string>, lookups: string[][] = []): OrphanedObjectRepository {
	return {
		recordedKeys: async (keys: readonly string[]) => {
			lookups.push([...keys])
			return new Set(keys.filter((key) => recorded.has(key)))
		},
	} as unknown as OrphanedObjectRepository
}

function agedBinary(): StoredBinary {
	return { key: randomUUID(), sizeBytes: 1, storedAt: BEFORE_CUTOFF }
}

describe("bytes in the buffer without a row CAP-026-R14 backend.md 2.1", () => {
	it("CAP-026-S07 digests only the aged bytes the database has no row for", async () => {
		const unrecorded = agedBinary()
		const recorded = agedBinary()
		const { store } = listingOf([unrecorded, recorded])
		const service = new UnrecordedBinaryService(store, recordedAmong(new Set([recorded.key])))

		expect(await service.storedBefore(CUTOFF)).toEqual([
			{ ...unrecorded, sha256: createHash("sha256").update(bytesOf(unrecorded.key)).digest("hex") },
		])
	})

	it("CAP-026-R14 stops listing once a run has a full batch", async () => {
		const binaries = Array.from({ length: ORPHAN_CLEANUP_BATCH_SIZE * 3 }, agedBinary)
		const listing = listingOf(binaries)
		const lookups: string[][] = []
		const service = new UnrecordedBinaryService(listing.store, recordedAmong(new Set(), lookups))

		const unrecorded = await service.storedBefore(CUTOFF)

		expect(unrecorded).toHaveLength(ORPHAN_CLEANUP_BATCH_SIZE)
		expect(listing.listedCount()).toBe(ORPHAN_CLEANUP_BATCH_SIZE)
		expect(lookups.map((keys) => keys.length)).toEqual([ORPHAN_CLEANUP_BATCH_SIZE])
	})

	it("CAP-026-R14 looks up the rows in batches and keeps every unrecorded one below the batch size", async () => {
		const recorded = Array.from({ length: ORPHAN_CLEANUP_BATCH_SIZE }, agedBinary)
		const unrecorded = agedBinary()
		const listing = listingOf([...recorded, unrecorded])
		const lookups: string[][] = []
		const service = new UnrecordedBinaryService(
			listing.store,
			recordedAmong(new Set(recorded.map((binary) => binary.key)), lookups),
		)

		expect((await service.storedBefore(CUTOFF)).map((binary) => binary.key)).toEqual([unrecorded.key])
		expect(lookups.map((keys) => keys.length)).toEqual([ORPHAN_CLEANUP_BATCH_SIZE, 1])
	})

	it("CAP-026-R14 skips bytes it cannot read and keeps the rest of the run", async () => {
		const unreadable = agedBinary()
		const readable = agedBinary()
		const { store } = listingOf([unreadable, readable], new Set([unreadable.key]))
		const service = new UnrecordedBinaryService(store, recordedAmong(new Set()))

		expect((await service.storedBefore(CUTOFF)).map((binary) => binary.key)).toEqual([readable.key])
	})
})
