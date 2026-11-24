import { useCallback, useState } from "react"

export function useIssue<T>(issue: () => Promise<T>) {
	const [issued, setIssued] = useState<T | undefined>(undefined)
	const [error, setError] = useState<unknown>(undefined)
	const [issuing, setIssuing] = useState(false)

	const start = useCallback(async (): Promise<T | undefined> => {
		setIssuing(true)
		setError(undefined)
		try {
			const result = await issue()
			setIssued(result)
			return result
		} catch (reason) {
			setError(reason)
			return undefined
		} finally {
			setIssuing(false)
		}
	}, [issue])

	const clear = useCallback(() => setIssued(undefined), [])
	return { issued, error, issuing, start, clear }
}
