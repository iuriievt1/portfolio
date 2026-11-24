import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { BinaryStorePort } from "@ansora/core-server"
import { Inject, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { messageOf } from "../../../libs/common/utils/error-message"
import { BINARY_STORE } from "../constants/binary-object.constants"
import { BinaryObjectRepository } from "../repositories/binary-object.repository"
import type { StoredBinaryObject } from "../types/binary-object.types"
import { sha256HexOf } from "../utils/sha256"

// datovy-model.md 4 Binární objekt, CAP-021-R35, CAP-026-R17
@Injectable()
export class BinaryObjectService {
	private readonly logger = new Logger(BinaryObjectService.name)

	constructor(
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
		private readonly objects: BinaryObjectRepository,
	) {}

	// CAP-021-R35, CAP-026-R14
	async putBytes(bytes: Buffer): Promise<StoredBinaryObject> {
		const object: StoredBinaryObject = { id: randomUUID(), sizeBytes: bytes.length, sha256: sha256HexOf(bytes) }
		await this.binaryStore.put(object.id, Readable.from(bytes))
		this.logger.log(`Put the bytes of binary object ${object.id} of ${object.sizeBytes} bytes`)
		return object
	}

	// CAP-021-R35
	async record(tx: postgres.TransactionSql, objects: readonly StoredBinaryObject[]): Promise<void> {
		await this.objects.insertAll(tx, objects)
	}

	// CAP-020-R22
	async read(binaryObjectId: string): Promise<Buffer> {
		try {
			const stream = await this.binaryStore.get(binaryObjectId)
			const chunks: Buffer[] = []
			for await (const chunk of stream) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
			}
			return Buffer.concat(chunks)
		} catch (error) {
			throw new Error(`the bytes of binary object ${binaryObjectId} cannot be read`, { cause: error })
		}
	}

	// CAP-021-R35, CAP-026-R18
	async isKept(binaryObjectId: string): Promise<boolean> {
		return await this.binaryStore.exists(binaryObjectId)
	}

	// CAP-026-R17
	async removeAll(tx: postgres.TransactionSql, binaryObjectIds: readonly string[]): Promise<void> {
		await this.objects.deleteAll(tx, binaryObjectIds)
	}

	// CAP-026-R17, datovy-model.md 4 Binární objekt
	async discardBytes(binaryObjectIds: readonly string[]): Promise<void> {
		for (const id of binaryObjectIds) {
			await this.binaryStore.delete(id).then(
				() => this.logger.log(`Deleted the bytes of binary object ${id}`),
				(error: unknown) => this.logger.error(`The bytes of binary object ${id} stay for cleanup: ${messageOf(error)}`),
			)
		}
	}
}
