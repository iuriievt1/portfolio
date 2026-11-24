import { sharedValue, useSharedValue } from "../../utils/shared-value"

export interface UnlockAccount {
	personalNumber: string
	displayName: string
}

const selected = sharedValue<UnlockAccount | undefined>(undefined)

export function selectUnlockAccount(account: UnlockAccount | undefined): void {
	selected.set(account)
}

export function useSelectedUnlockAccount(): UnlockAccount | undefined {
	return useSharedValue(selected)
}
