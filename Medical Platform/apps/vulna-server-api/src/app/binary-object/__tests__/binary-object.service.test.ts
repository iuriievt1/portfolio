import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LocalBinaryStore } from "@ansora/vulna-adapter-binary-local"
import type postgres from "@veevoy/postgres"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EnvVariable } from "../../../libs/common/constants/env-variable.constants"
import { EnvVariableService } from "../../../libs/common/services/env-variable.service"
import type { BinaryObjectRepository } from "../repositories/binary-object.repository"
import { BinaryObjectService } from "../services/binary-object.service"
import type { StoredBinaryObject } from "../types/binary-object.types"
import { localBinaryStoreOf } from "../utils/local-binary-store"

const TX = {} as postgres.TransactionSql
const BYTES = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9])

describe("binary objects behind the BinaryStore port CAP-021-R35", () => {
	let root: string
	let inserted: StoredBinaryObject[][]
	let deleted: string[][]
	let service: BinaryObjectService

	beforeEach(async () => {
		root = await mkdtemp(join(tmpdir(), "vulna-binary-object-"))
		inserted = []
		deleted = []
		const objects = {
			insertAll: async (_tx: never, rows: readonly StoredBinaryObject[]) => {
				inserted.push([...rows])
			},
			deleteAll: async (_tx: never, ids: readonly string[]) => {
				deleted.push([...ids])
			},
		} as unknown as BinaryObjectRepository
		service = new BinaryObjectService(new LocalBinaryStore(root), objects)
	})

	afterEach(async () => {
		await rm(root, { recursive: true, force: true })
	})

	it("CAP-026-R14 puts the bytes under a new id before any row exists", async () => {
		const stored = await service.putBytes(BYTES)

		expect(stored).toEqual({
			id: expect.stringMatching(/^[0-9a-f-]{36}$/),
			sizeBytes: BYTES.length,
			sha256: createHash("sha256").update(BYTES).digest("hex"),
		})
		expect(inserted).toEqual([])
		expect(await readFile(join(root, stored.id))).toEqual(BYTES)
	})

	it("records the rows of the put bytes in one statement", async () => {
		const first = await service.putBytes(BYTES)
		const second = await service.putBytes(Buffer.from("thumbnail"))

		await service.record(TX, [first, second])

		expect(inserted).toEqual([[first, second]])
	})

	it("reads the stored bytes back", async () => {
		const stored = await service.putBytes(BYTES)

		expect(await service.read(stored.id)).toEqual(BYTES)
	})

	it("names the object whose bytes cannot be read", async () => {
		await expect(service.read("missing-object")).rejects.toThrow(/missing-object/)
	})

	it("CAP-026-R17 removes the row in the transaction and the bytes only when asked after it", async () => {
		const stored = await service.putBytes(BYTES)

		await service.removeAll(TX, [stored.id])

		expect(deleted).toEqual([[stored.id]])
		expect(await service.read(stored.id)).toEqual(BYTES)
		await service.discardBytes([stored.id])
		await expect(service.read(stored.id)).rejects.toThrow(stored.id)
	})
})

describe("binary store configuration ADR-003 ř. 31", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("refuses to start without its directory and names the variable", () => {
		vi.stubEnv(EnvVariable.BINARY_STORE_PATH, "")

		expect(() => localBinaryStoreOf(new EnvVariableService())).toThrow(/BINARY_STORE_PATH/)
	})
})
