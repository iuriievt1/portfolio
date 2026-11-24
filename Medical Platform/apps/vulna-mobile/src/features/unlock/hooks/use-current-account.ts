import { type CurrentPinAccount, cryptoAndKeys } from "@ansora/core-mobile"
import { useEffect, useState } from "react"

export interface CurrentAccount {
	loaded: boolean
	account: CurrentPinAccount | undefined
}

export function useCurrentAccount(): CurrentAccount {
	const [state, setState] = useState<CurrentAccount>({ loaded: false, account: undefined })
	useEffect(() => {
		let active = true
		void cryptoAndKeys()
			.currentPinAccount()
			.catch((failure: unknown) => {
				console.warn("current PIN account could not be read", failure)
				return null
			})
			.then((account) => {
				if (active) {
					setState({ loaded: true, account: account ?? undefined })
				}
			})
		return () => {
			active = false
		}
	}, [])
	return state
}
