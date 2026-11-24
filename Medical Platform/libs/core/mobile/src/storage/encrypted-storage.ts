import { openDatabaseAsync } from "expo-sqlite"
import type { CryptoAndKeys, KeyDomain } from "../native"
import { NATIVE_ERROR_CODE, nativeErrorCodeOf } from "../native/error-codes"
import { openEncryptedDatabase } from "./encrypted-database"
import { EncryptedFileStore } from "./encrypted-file-store"
import { type QueueNoticeRecords, SqlQueueNoticeRecords } from "./queue-notice"
import { type QueuedClosureRecords, SqlQueuedClosureRecords } from "./queued-closure"
import { SerialSqlDatabase, type SqlDatabase, type SqlDatabaseOpener } from "./sql-database"
import { SqlStoredFileRecords } from "./sql-stored-file-records"
import { SqlStorageLossRecords, type StorageLossRecords } from "./storage-loss"
import { SqlBufferedFileRecords, SqlSealedCopyRecords, TransferBuffer } from "./transfer-buffer"

export interface EncryptedStorage {
	files: EncryptedFileStore
	buffer: TransferBuffer
	closures: QueuedClosureRecords
	notices: QueueNoticeRecords
	losses: StorageLossRecords
	close(): Promise<void>
}

async function openSqliteDatabase(fileName: string, directory: string): Promise<SqlDatabase> {
	return openDatabaseAsync(fileName, undefined, directory)
}

// CAP-009-S05, ADR-038, Q-076
export async function openEncryptedStorage(
	domain: KeyDomain,
	module: CryptoAndKeys,
	open: SqlDatabaseOpener = openSqliteDatabase,
	now: () => Date = () => new Date(),
): Promise<EncryptedStorage> {
	try {
		return await storageOf(domain, module, open)
	} catch (failure) {
		if (nativeErrorCodeOf(failure) !== NATIVE_ERROR_CODE.KEY_INVALIDATED) {
			throw failure
		}
		console.warn(`the ${domain} storage no longer opens; it is set aside`, failure)
		await module.setStorageAside(domain)
		return await withLossRecorded(await storageOf(domain, module, open), now())
	}
}

// CAP-009-S05, Q-076
async function withLossRecorded(storage: EncryptedStorage, lostAt: Date): Promise<EncryptedStorage> {
	try {
		await storage.losses.record(lostAt.toISOString())
		return storage
	} catch (failure) {
		await storage.close()
		throw failure
	}
}

async function storageOf(domain: KeyDomain, module: CryptoAndKeys, open: SqlDatabaseOpener): Promise<EncryptedStorage> {
	const directory = await module.storageDirectory(domain)
	const key = await module.databaseKey(domain)
	const db = new SerialSqlDatabase(await openEncryptedDatabase(domain, key, directory, open))
	const files = new EncryptedFileStore(domain, module, new SqlStoredFileRecords(db))
	return {
		files,
		buffer: new TransferBuffer(files, new SqlBufferedFileRecords(db), new SqlSealedCopyRecords(db)),
		closures: new SqlQueuedClosureRecords(db),
		notices: new SqlQueueNoticeRecords(db),
		losses: new SqlStorageLossRecords(db),
		close: () => db.closeAsync(),
	}
}
