import * as SecureStore from "expo-secure-store"

export interface StoredJson<T> {
	read(): Promise<T | undefined>
	write(value: T): Promise<void>
	clear(): Promise<void>
}

// zarizeni-a-sifrovani.md 1.1
export function storedJson<T>(key: string, parse: (stored: string | null) => T | undefined): StoredJson<T> {
	return {
		read: async () => parse(await SecureStore.getItemAsync(key)),
		write: async (value) => {
			await SecureStore.setItemAsync(key, JSON.stringify(value))
		},
		clear: async () => {
			await SecureStore.deleteItemAsync(key)
		},
	}
}
