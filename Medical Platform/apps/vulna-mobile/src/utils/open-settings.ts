import { Linking } from "react-native"

export function openSettings(): void {
	void Linking.openSettings().catch((failure: unknown) => console.warn("settings could not be opened", failure))
}
