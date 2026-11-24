import { nfcReader } from "@ansora/core-mobile"

export function openNfcSettings(): void {
	void nfcReader()
		.openSettings()
		.catch((failure: unknown) => console.warn("NFC settings could not be opened", failure))
}
