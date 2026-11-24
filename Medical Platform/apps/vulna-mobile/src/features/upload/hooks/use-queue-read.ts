import { useEffect, useState } from "react"
import { onQueueChange } from "../queue-changes"

// CAP-019-R08, CAP-019-R23
export function useQueueRead<Value>(read: (() => Promise<Value>) | undefined, empty: Value): Value {
	const [value, setValue] = useState(empty)

	useEffect(() => {
		if (read === undefined) {
			setValue(empty)
			return
		}
		let isCurrent = true
		const reread = () => {
			read()
				.then((current) => {
					if (isCurrent) {
						setValue(current)
					}
				})
				.catch((failure: unknown) => console.warn("the queue could not be read", failure))
		}
		reread()
		const stopListening = onQueueChange(reread)
		return () => {
			isCurrent = false
			stopListening()
		}
	}, [read, empty])

	return value
}
