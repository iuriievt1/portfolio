import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { StoredBinaryObject } from "../types/binary-object.types"

// datovy-model.md 4 Binární objekt, CAP-021-R35
@Injectable()
export class BinaryObjectRepository {
	async insertAll(tx: postgres.TransactionSql, objects: readonly StoredBinaryObject[]): Promise<void> {
		if (objects.length === 0) {
			return
		}
		const rows = objects.map((object) => ({ id: object.id, size_bytes: object.sizeBytes, sha256: object.sha256 }))
		await tx`INSERT INTO binary_object ${tx(rows, "id", "size_bytes", "sha256")}`
	}

	// CAP-026-R17
	async deleteAll(tx: postgres.TransactionSql, ids: readonly string[]): Promise<void> {
		if (ids.length === 0) {
			return
		}
		await tx`DELETE FROM binary_object WHERE id IN ${tx([...ids])}`
	}
}
