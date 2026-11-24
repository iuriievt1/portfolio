import type { CryptoAndKeys, EncryptedFile, KeyDomain } from "../native"

export interface StoredFile {
	id: string
	path: string
	wrappedKey: string
	createdAt: string
}

export interface StoredFileRecords {
	insert(record: StoredFile): Promise<void>
	find(id: string): Promise<StoredFile | undefined>
	remove(id: string): Promise<void>
}

export type FileEncryption = Pick<CryptoAndKeys, "encryptFile" | "encryptBytes" | "decryptFile" | "removeFile">

export const STORED_FILE_NOT_FOUND = "stored-file-not-found"

export class StoredFileNotFoundError extends Error {
	readonly code = STORED_FILE_NOT_FOUND

	constructor(readonly id: string) {
		super(`No stored file with id ${id}`)
		this.name = "StoredFileNotFoundError"
	}
}

export class EncryptedFileStore {
	constructor(
		readonly domain: KeyDomain,
		private readonly cipher: FileEncryption,
		private readonly records: StoredFileRecords,
		private readonly now: () => Date = () => new Date(),
	) {}

	async storeFile(id: string, sourcePath: string): Promise<StoredFile> {
		const encrypted = await this.cipher.encryptFile(sourcePath, this.domain)
		return this.record(id, encrypted.path, encrypted.wrappedKey)
	}

	async storeBytes(id: string, data: Uint8Array): Promise<StoredFile> {
		const encrypted = await this.cipher.encryptBytes(data, this.domain)
		return this.record(id, encrypted.path, encrypted.wrappedKey)
	}

	// CAP-009-R09
	async adopt(id: string, encrypted: EncryptedFile): Promise<StoredFile> {
		return this.record(id, encrypted.path, encrypted.wrappedKey)
	}

	async discard(encrypted: EncryptedFile): Promise<void> {
		await this.discardPath(encrypted.path)
	}

	// CAP-009-R13
	async discardPath(path: string): Promise<void> {
		await this.cipher.removeFile(path)
	}

	async find(id: string): Promise<StoredFile> {
		const stored = await this.records.find(id)
		if (!stored) {
			throw new StoredFileNotFoundError(id)
		}
		return stored
	}

	async read(id: string): Promise<Uint8Array> {
		const stored = await this.find(id)
		return this.cipher.decryptFile(stored.path, stored.wrappedKey, this.domain)
	}

	async destroy(id: string): Promise<void> {
		const stored = await this.find(id)
		await this.records.remove(id)
		await this.cipher.removeFile(stored.path)
	}

	private async record(id: string, path: string, wrappedKey: string): Promise<StoredFile> {
		const stored: StoredFile = { id, path, wrappedKey, createdAt: this.now().toISOString() }
		try {
			await this.records.insert(stored)
		} catch (failure) {
			await this.cipher.removeFile(path)
			throw failure
		}
		return stored
	}
}
