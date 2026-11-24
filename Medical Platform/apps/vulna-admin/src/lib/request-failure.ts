import { errorMessageOf } from "./error-message"

export function requestFailure(error: unknown): string | undefined {
	return error === undefined ? undefined : errorMessageOf(error)
}
