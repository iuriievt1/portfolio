import * as SecureStore from "expo-secure-store"

export interface StoredSeconds {
	remember(seconds: number | undefined): void
	read(): Promise<number | undefined>
}

export function storedSeconds(key: string): StoredSeconds {
	return {
		remember: (seconds) => {
			if (seconds === undefined) {
				return
			}
			SecureStore.setItemAsync(key, String(seconds)).catch((failure: unknown) =>
				console.warn(`the setting ${key} could not be stored`, failure),
			)
		},
		read: async () => {
			try {
				const stored = Number(await SecureStore.getItemAsync(key))
				return Number.isInteger(stored) && stored > 0 ? stored : undefined
			} catch (failure) {
				console.warn(`the setting ${key} could not be read`, failure)
				return undefined
			}
		},
	}
}
