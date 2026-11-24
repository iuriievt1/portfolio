import { acceptsPinDigit } from "@ansora/core-mobile"
import { useCallback, useState } from "react"

export interface PinEntry {
	pin: string
	digit: (digit: string) => void
	erase: () => void
	clear: () => void
}

export function usePinEntry(): PinEntry {
	const [pin, setPin] = useState("")
	const digit = useCallback((entered: string) => {
		setPin((typed) => (acceptsPinDigit(typed) ? `${typed}${entered}` : typed))
	}, [])
	const erase = useCallback(() => setPin((typed) => typed.slice(0, -1)), [])
	const clear = useCallback(() => setPin(""), [])
	return { pin, digit, erase, clear }
}
