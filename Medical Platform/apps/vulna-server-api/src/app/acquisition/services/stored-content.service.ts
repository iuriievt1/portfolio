import { Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import type { KeptContent, OpenedContent, StoredContent } from "../types/acquisition-file.types"
import { storedObjectsOf } from "../utils/file-objects"

// CAP-021-R35, CAP-026-R14
@Injectable()
export class StoredContentService {
	constructor(private readonly binaries: BinaryObjectService) {}

	async put(opened: OpenedContent): Promise<StoredContent> {
		const file = await this.binaries.putBytes(opened.file)
		if (opened.thumbnail === undefined) {
			return { file, thumbnail: undefined }
		}
		try {
			return { file, thumbnail: await this.binaries.putBytes(opened.thumbnail) }
		} catch (error) {
			await this.binaries.discardBytes([file.id])
			throw error
		}
	}

	async record(tx: postgres.TransactionSql, content: StoredContent): Promise<void> {
		await this.binaries.record(tx, storedObjectsOf(content))
	}

	async keptOrDiscarded<Result>(content: StoredContent, work: () => Promise<KeptContent<Result>>): Promise<Result> {
		const objectIds = storedObjectsOf(content).map((object) => object.id)
		try {
			const kept = await work()
			if (!kept.isContentKept) {
				await this.binaries.discardBytes(objectIds)
			}
			return kept.result
		} catch (error) {
			await this.binaries.discardBytes(objectIds)
			throw error
		}
	}
}
