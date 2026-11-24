import type { IntegrityBlock } from "@ansora/core-mobile"
import { useCallback, useEffect, useRef, useState } from "react"
import { useAppReturn } from "../../session/hooks/use-app-return"
import { checkDeviceIntegrity, leaveIntegrityBlock, watchDeviceIntegrity } from "../device-integrity"
import { eraseAfterIntegrityBlock, reportBlockToServer } from "../integrity-erasure"

export interface DeviceIntegrity {
	checked: boolean
	block: IntegrityBlock | undefined
}

const UNCHECKED: DeviceIntegrity = { checked: false, block: undefined }

const NO_RETRY = () => undefined

// CAP-008-R01, CAP-008-S01, CAP-008-S10
export function useDeviceIntegrity(isServerKnown: boolean): DeviceIntegrity {
	const [integrity, setIntegrity] = useState<DeviceIntegrity>(UNCHECKED)
	const [erased, setErased] = useState<IntegrityBlock | undefined>(undefined)
	const [shown, setShown] = useState<IntegrityBlock | undefined>(undefined)
	const retry = useRef<() => void>(NO_RETRY)
	const isWatched = integrity.checked && integrity.block === undefined

	// CAP-006-R19, CAP-006-S13
	const leave = useCallback(() => {
		setShown(undefined)
		setErased(undefined)
		setIntegrity({ checked: true, block: undefined })
	}, [])

	useEffect(() => {
		let active = true
		checkDeviceIntegrity()
			.catch((failure: unknown) => {
				console.warn("the integrity of the device could not be checked", failure)
				return undefined
			})
			.then((block) => {
				if (active) {
					setIntegrity({ checked: true, block })
				}
			})
		return () => {
			active = false
		}
	}, [])

	// CAP-008-S02
	useEffect(() => {
		if (!isWatched) {
			return
		}
		return watchDeviceIntegrity((block) =>
			setIntegrity((current) => (current.block === undefined ? { checked: true, block } : current)),
		)
	}, [isWatched])

	// CAP-008-R06, CAP-008-R10
	useEffect(() => {
		const block = integrity.block
		if (block === undefined) {
			return
		}
		let active = true
		eraseAfterIntegrityBlock(block)
			.catch((failure: unknown) => {
				console.warn("the local data could not be erased after the block", failure)
				return block
			})
			.then((next) => {
				if (active) {
					setShown(next)
					setErased(next)
				}
			})
		return () => {
			active = false
		}
	}, [integrity.block])

	// CAP-008-R04, CAP-008-S03, CAP-025-S15, CAP-006-S13
	useEffect(() => {
		if (erased === undefined || !isServerKnown) {
			return
		}
		let active = true
		const settle = async () => {
			const reported = await reportedBlock(erased)
			if (!active) {
				return
			}
			setShown(reported)
			if ((await leaveIntegrityBlock()) && active) {
				leave()
			}
		}
		retry.current = () => void settle()
		void settle()
		return () => {
			active = false
			retry.current = NO_RETRY
		}
	}, [erased, isServerKnown, leave])

	useAppReturn({ onReturn: () => retry.current() }, integrity.block !== undefined)

	return { checked: integrity.checked, block: shown ?? integrity.block }
}

function reportedBlock(block: IntegrityBlock): Promise<IntegrityBlock> {
	return reportBlockToServer(block).catch((failure: unknown) => {
		console.warn("the block of the device could not be reported", failure)
		return block
	})
}
