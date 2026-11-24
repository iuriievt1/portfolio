import { REMOTE_FAILURE, type RemoteFailure } from "../../api/remote-failure"
import type { Texts } from "../../i18n/texts"

export interface RemoteFailureText {
	heading: string
	body: string
}

// CAP-002-R17, ADR-054, E29, E70, E129
export function remoteFailureTextOf(
	failure: RemoteFailure,
	serverErrorHeading: string,
	texts: Texts,
): RemoteFailureText {
	switch (failure) {
		case REMOTE_FAILURE.NO_CONNECTION:
			return texts.remote.noConnection
		case REMOTE_FAILURE.DOCUMENTATION_UNAVAILABLE:
			return texts.remote.documentationUnavailable
		case REMOTE_FAILURE.SERVER_ERROR:
			return { heading: serverErrorHeading, body: texts.remote.serverError }
		case REMOTE_FAILURE.NOT_FOUND:
			return texts.remote.notFound
		default:
			return failure satisfies never
	}
}
