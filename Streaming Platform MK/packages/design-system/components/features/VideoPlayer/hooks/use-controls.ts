import { use } from 'react'
import { ControlsContext, type ControlsState } from '../context'

export function useControls(): ControlsState {
	const ctx = use(ControlsContext)
	if (!ctx) throw new Error('useControls must be used within <VideoPlayer>')
	return ctx
}
