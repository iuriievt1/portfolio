import { requireNativeModule } from "expo"
import type { NetworkPinning } from "./index"

const MODULE_NAME = "NetworkPinning"

export function networkPinning(): NetworkPinning {
	return requireNativeModule<NetworkPinning>(MODULE_NAME)
}
