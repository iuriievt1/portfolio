import type { Readable } from "node:stream"

/**
 * Port `BinaryStore` — store artifact bytes ✓ ADR-003 ř. 21.
 *
 * In the MOÚ profile the `binary-local` adapter implements it ✓ ADR-003 ř. 31. Data stay
 * exclusively inside the customer's infrastructure ✓ NAB-022, NAB-023, NAB-660.
 */
export interface BinaryStorePort {
	put(key: string, content: Readable): Promise<void>
	get(key: string): Promise<Readable>
	/** The retention job deletes by the retention anchor ✓ ADR-005 ř. 34, CAP-026. */
	delete(key: string): Promise<void>
	exists(key: string): Promise<boolean>
}

// CAP-026-R14, backend.md 2.1, dorucovaci-jadro.md 2
export interface StoredBinary {
	key: string
	sizeBytes: number
	storedAt: Date
}

// CAP-026-R14, CAP-026-S07, backend.md 2.1, dorucovaci-jadro.md 2
export interface BinaryInventoryPort {
	list(): AsyncIterable<StoredBinary>
}

// CAP-021-R36, backend.md 3.2
export interface BinaryPlacement {
	contentType: string
	ownerReference: string
}

// architektura.md 3 „Port BinaryStore po D31“, ADR-003 (doplnění D31), CAP-021-R36, ADR-050 bod 10
export interface DurableBinaryStorePort {
	upload(content: Readable, placement: BinaryPlacement): Promise<string>
	sha256Of(binaryId: string): Promise<string | undefined>
}

// ADR-053 (doplnění 2026-09-24) bod 1, CAP-020-R22, datovy-model.md 13.4
export interface DurableBinaryLinkPort {
	downloadLinkOf(binaryId: string, expiresAt: Date): Promise<string>
}

// CAP-026-R19, CAP-026-R20, dorucovaci-jadro.md 6, ADR-050 bod 14, ADR-050 bod 17
export interface DurableBinaryRemovalPort {
	removeWithVersions(binaryId: string): Promise<void>
}
