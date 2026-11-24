import { cryptoAndKeys } from "@ansora/core-mobile"
import { bytesOfBase64Url, uuidOfRandomBytes } from "./uuid"

// CAP-014-R06, CAP-021-R08
export async function randomUuid(): Promise<string> {
	return uuidOfRandomBytes(bytesOfBase64Url(await cryptoAndKeys().randomIdentifier()))
}
