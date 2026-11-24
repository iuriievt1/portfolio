import type { BinaryInventoryPort, BinaryStorePort } from "@ansora/core-server"

// CAP-021-R35, CAP-026-R14
export type BufferStore = BinaryStorePort & BinaryInventoryPort
