import type { BufferedFile } from "@ansora/core-mobile"
import { useEffect, useState } from "react"
import { jpegDataUriOf } from "../../../utils/base64"
import { transferBuffer } from "../../upload/transfer-store"

// CAP-018-R10, CAP-009-R17
export function useOriginalImage({ originalFileId }: Pick<BufferedFile, "originalFileId">): string | undefined {
	const [uri, setUri] = useState<string | undefined>(undefined)

	useEffect(() => {
		let isCurrent = true
		const read = async () => {
			const bytes = await (await transferBuffer()).originalBytes({ originalFileId })
			if (isCurrent && bytes !== undefined) {
				setUri(jpegDataUriOf(bytes))
			}
		}
		read().catch((failure: unknown) => console.warn("the original of the page could not be shown", failure))
		return () => {
			isCurrent = false
		}
	}, [originalFileId])

	return uri
}
