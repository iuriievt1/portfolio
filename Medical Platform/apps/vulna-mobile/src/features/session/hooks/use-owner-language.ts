import { useEffect } from "react"
import { setSignedInLanguage } from "../../../i18n/language-store"
import { ownerLanguageOf } from "../owner-language"

// CAP-015-R25
export function useOwnerLanguage(ownerPersonalNumber: string | undefined): void {
	useEffect(() => {
		if (ownerPersonalNumber === undefined) {
			setSignedInLanguage(undefined)
			return
		}
		let active = true
		void ownerLanguageOf(ownerPersonalNumber)
			.then((language) => {
				if (active) {
					setSignedInLanguage(language)
				}
			})
			.catch((failure: unknown) => console.warn("the owner's language could not be read", failure))
		return () => {
			active = false
		}
	}, [ownerPersonalNumber])
}
