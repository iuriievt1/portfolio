import * as Updates from 'expo-updates'
import { useEffect } from 'react'

export function useOTAUpdates() {
	useEffect(() => {
		if (__DEV__) return

		async function checkAndApplyUpdate() {
			try {
				const { isAvailable } = await Updates.checkForUpdateAsync()
				if (!isAvailable) return

				const { isNew } = await Updates.fetchUpdateAsync()
				if (isNew) {
					await Updates.reloadAsync()
				}
			} catch (err) {
				// Best-effort — never block startup, but leave a trace.
				console.warn('[OTA] update check failed', err)
			}
		}

		checkAndApplyUpdate()
	}, [])
}
