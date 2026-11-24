import { randomUUID } from "node:crypto"
import { sha256Hex } from "@ansora/core-server"
import type postgres from "@veevoy/postgres"

// datovy-model.md 4
export interface BinaryObject {
	binaryObjectId: string
	sizeBytes: number
	sha256: string
}

export function binaryObjectOf(content: Buffer): BinaryObject {
	return { binaryObjectId: randomUUID(), sizeBytes: content.length, sha256: sha256Hex(content) }
}

export async function insertBinaryObject(tx: postgres.TransactionSql, object: BinaryObject): Promise<void> {
	await insertBinaryObjects(tx, [object])
}

export async function insertBinaryObjects(
	tx: postgres.TransactionSql,
	objects: readonly BinaryObject[],
): Promise<void> {
	if (objects.length === 0) {
		return
	}
	const rows = objects.map((object) => ({
		id: object.binaryObjectId,
		size_bytes: object.sizeBytes,
		sha256: object.sha256,
	}))
	await tx`INSERT INTO binary_object ${tx(rows, "id", "size_bytes", "sha256")}`
}
