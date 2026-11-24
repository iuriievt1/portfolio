import { LOGIN_NAME_MAX_LENGTH } from "@ansora/contracts"
import { boundedText } from "../text"

// identity.yaml loginWithBarcode
export function loginNameOfBarcode(content: string): string | undefined {
	return boundedText(content, LOGIN_NAME_MAX_LENGTH)
}
