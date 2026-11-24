import { useCallback, useState } from "react"

export interface SaveState {
	saving: boolean
	failure: unknown
	savedAt: string | undefined
	save: <T>(request: () => Promise<T>) => Promise<T | undefined>
}

export function useSave(): SaveState {
	const [saving, setSaving] = useState(false)
	const [failure, setFailure] = useState<unknown>(undefined)
	const [savedAt, setSavedAt] = useState<string | undefined>(undefined)

	const save = useCallback(async <T>(request: () => Promise<T>): Promise<T | undefined> => {
		setSaving(true)
		setFailure(undefined)
		try {
			const result = await request()
			setSavedAt(new Date().toISOString())
			return result
		} catch (error) {
			setFailure(error)
			return undefined
		} finally {
			setSaving(false)
		}
	}, [])

	return { saving, failure, savedAt, save }
}
