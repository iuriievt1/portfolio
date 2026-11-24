import { type ApiMethod, apiUrlOf, exchange, fetchFromServer, signedRequestHeaders, type VersionCheck } from "./client"

const FILE_URI_PREFIX = "file://"

export interface FilePart {
	name: string
	path: string
	filename: string
	contentType: string
}

interface TextPart {
	name: string
	value: string
	contentType?: string
}

export interface MultipartBody {
	texts: readonly TextPart[]
	files: readonly FilePart[]
}

// CAP-015-R34, CAP-018-R11, ADR-015, CAP-012-R25
export async function sendMultipart(
	method: ApiMethod,
	path: string,
	sessionToken: string,
	headers: Readonly<Record<string, string>>,
	body: MultipartBody,
	versionCheck: VersionCheck,
): Promise<Response> {
	const url = apiUrlOf(path)
	return await exchange(
		async () =>
			fetchFromServer(url, {
				method,
				headers: { ...(await signedRequestHeaders(method, url, sessionToken)), ...headers },
				body: formOf(body),
			}),
		versionCheck,
	)
}

function formOf({ texts, files }: MultipartBody): FormData {
	const form = new FormData()
	for (const text of texts) {
		form.append(text.name, multipartValue({ string: text.value, type: text.contentType }))
	}
	for (const file of files) {
		form.append(
			file.name,
			multipartValue({ uri: `${FILE_URI_PREFIX}${file.path}`, name: file.filename, type: file.contentType }),
		)
	}
	return form
}

function multipartValue(part: { string?: string; uri?: string; name?: string; type?: string | undefined }): Blob {
	return part as unknown as Blob
}
