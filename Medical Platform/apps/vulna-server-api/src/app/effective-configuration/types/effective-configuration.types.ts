import type { MobileContract } from "@ansora/contracts"
import type { LoginMethodOverrides } from "@ansora/core-server"

export type EffectiveConfiguration = MobileContract.components["schemas"]["EffectiveConfiguration"]

export interface DeviceLevels {
	groupCode: string | null
	loginMethods: LoginMethodOverrides
}
