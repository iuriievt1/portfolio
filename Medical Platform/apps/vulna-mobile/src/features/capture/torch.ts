import { useCallback } from "react"
import { sharedValue, useSharedValue } from "../../utils/shared-value"

interface TorchState {
	visitId: string | undefined
	isOn: boolean
}

const OFF: TorchState = { visitId: undefined, isOn: false }

const torch = sharedValue<TorchState>(OFF)

// CAP-015-R10
export function useTorch(visitId: string): { isOn: boolean; toggle: () => void } {
	const state = useSharedValue(torch)
	const isOn = state.visitId === visitId && state.isOn
	const toggle = useCallback(() => torch.set({ visitId, isOn: !isOn }), [visitId, isOn])
	return { isOn, toggle }
}

export function forgetTorch(): void {
	torch.set(OFF)
}
