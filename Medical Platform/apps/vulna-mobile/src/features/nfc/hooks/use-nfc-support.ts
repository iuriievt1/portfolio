import { nfcReader } from "@ansora/core-mobile"
import { useEffect, useState } from "react"

export function useNfcSupport(): boolean {
	const [supported, setSupported] = useState(false)
	useEffect(() => {
		let active = true
		void nfcReader()
			.isSupported()
			.then((value) => {
				if (active) {
					setSupported(value)
				}
			})
		return () => {
			active = false
		}
	}, [])
	return supported
}
