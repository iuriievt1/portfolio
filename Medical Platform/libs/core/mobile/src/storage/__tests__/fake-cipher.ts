import { CodedError } from "../../__tests__/coded-error"
import type { EncryptedFile, KeyDomain } from "../../native"
import type { FileEncryption } from "../encrypted-file-store"

export interface FakeCiphertext {
	data: Uint8Array
	wrappedKey: string
	domain: KeyDomain
}

export class FakeCipher implements FileEncryption {
	readonly files = new Map<string, FakeCiphertext>()
	readonly removedSources: string[] = []
	viewingOpen = true
	spaceLeft = true
	private sequence = 0

	async encryptFile(sourcePath: string, domain: KeyDomain): Promise<EncryptedFile> {
		this.removedSources.push(sourcePath)
		return this.encryptBytes(new TextEncoder().encode(sourcePath), domain)
	}

	async encryptBytes(data: Uint8Array, domain: KeyDomain): Promise<EncryptedFile> {
		if (!this.spaceLeft) {
			throw new CodedError("storage-full")
		}
		this.sequence += 1
		const path = `/vault/${domain}/${this.sequence}`
		const wrappedKey = `wrapped-${this.sequence}`
		this.files.set(path, { data, wrappedKey, domain })
		return { path, wrappedKey }
	}

	async decryptFile(path: string, wrappedKey: string, domain: KeyDomain): Promise<Uint8Array> {
		if (domain === "viewing" && !this.viewingOpen) {
			throw new CodedError("viewing-key-locked")
		}
		const file = this.files.get(path)
		if (!file || file.wrappedKey !== wrappedKey) {
			throw new CodedError("file-key-invalid")
		}
		return file.data
	}

	async removeFile(path: string): Promise<void> {
		this.files.delete(path)
	}

	sealedByModule(name: string, domain: KeyDomain = "queue"): EncryptedFile {
		const path = `/vault/${domain}/${name}`
		const wrappedKey = `${name}-key`
		this.files.set(path, { data: new TextEncoder().encode(name), wrappedKey, domain })
		return { path, wrappedKey }
	}
}
