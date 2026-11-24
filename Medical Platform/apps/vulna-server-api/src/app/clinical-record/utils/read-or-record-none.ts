import { DocumentationUnavailableException } from "../exceptions/documentation-unavailable.exception"

// CAP-025-R18, CAP-025-R28, CAP-020-R16
export async function readOrRecordNone<T>(read: () => Promise<T>, recordNone: () => Promise<void>): Promise<T> {
	try {
		return await read()
	} catch (error) {
		if (error instanceof DocumentationUnavailableException) {
			await recordNone()
		}
		throw error
	}
}
