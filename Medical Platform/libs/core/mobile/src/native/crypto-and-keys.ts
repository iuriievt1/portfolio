import { requireNativeModule } from "expo"
import type { CryptoAndKeys } from "./index"

const MODULE_NAME = "CryptoAndKeys"

export function cryptoAndKeys(): CryptoAndKeys {
	return requireNativeModule<CryptoAndKeys>(MODULE_NAME)
}
