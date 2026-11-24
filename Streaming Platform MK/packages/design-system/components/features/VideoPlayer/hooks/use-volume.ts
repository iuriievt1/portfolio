import { use } from 'react'
import { VolumeContext, type VolumeState } from '../context'

export function useVolume(): VolumeState {
	const ctx = use(VolumeContext)
	if (!ctx) throw new Error('useVolume must be used within <VideoPlayer>')
	return ctx
}
