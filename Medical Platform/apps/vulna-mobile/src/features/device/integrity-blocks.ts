import { type IntegrityBlockStore, integrityBlockOf } from "@ansora/core-mobile"
import { storedJson } from "../../utils/stored-json"

const INTEGRITY_BLOCK_KEY = "ansora.vulna.integrity-block"

// CAP-008-R03, CAP-006-R19, zarizeni-a-sifrovani.md 1.1
export const integrityBlocks: IntegrityBlockStore = storedJson(INTEGRITY_BLOCK_KEY, integrityBlockOf)
