import { useCallback, useState } from "react"

interface LargestHeight {
	height: number | undefined
	record: (height: number) => void
}

// CAP-016-R17
export function useLargestHeight(): LargestHeight {
	const [height, setHeight] = useState<number | undefined>(undefined)

	const record = useCallback((measured: number) => {
		setHeight((largest) => (largest !== undefined && largest >= measured ? largest : measured))
	}, [])

	return { height, record }
}
