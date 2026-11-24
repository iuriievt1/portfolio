import type postgres from "@veevoy/postgres"
import type { BinaryObjectService } from "../../src/app/binary-object/services/binary-object.service"
import type { StoredBinaryObject } from "../../src/app/binary-object/types/binary-object.types"
import type { PlannedFile, StoredAsset } from "./demo-types"
import { readAsset } from "./files"

// CAP-021-R35, CAP-026-R14, ADR-026
export class SeedFileStore {
	private readonly putIds: string[] = []

	constructor(private readonly binaries: BinaryObjectService) {}

	async store(tx: postgres.TransactionSql, file: PlannedFile): Promise<StoredAsset> {
		const asset = await readAsset(file.asset_kind, file.asset_name)
		const original = await this.put(asset.original)
		const thumbnail = await this.put(asset.thumbnail)
		await this.binaries.record(tx, [original, thumbnail])
		return { original, thumbnail }
	}

	// CAP-026-R17
	async discardStored(): Promise<void> {
		await this.binaries.discardBytes(this.putIds)
	}

	private async put(bytes: Buffer): Promise<StoredBinaryObject> {
		const object = await this.binaries.putBytes(bytes)
		this.putIds.push(object.id)
		return object
	}
}
