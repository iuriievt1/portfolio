// dev/pacs/orthanc.json, ADR-024, Q-041
const INSTANCE_LEVEL = "Instance"
const FIRST_FRAME = 0
// DICOM PS3.3 C.24.2, Encapsulated Document (0042,0011)
const ENCAPSULATED_DOCUMENT_TAG = "0042-0011"
const JSON_CONTENT_TYPE = "application/json"
// DICOM PS3.5 A.4, ITU-T T.81 B.1.1.3
const FRAGMENT_PADDING = 0x00
const END_OF_IMAGE = Buffer.from([0xff, 0xd9])
const EVEN = 2

export function withoutFragmentPadding(frame: Buffer): Buffer {
	const unpadded = frame.subarray(0, -1)
	const isPadded =
		frame.length % EVEN === 0 &&
		frame.at(-1) === FRAGMENT_PADDING &&
		unpadded.subarray(-END_OF_IMAGE.length).equals(END_OF_IMAGE)
	return isPadded ? unpadded : frame
}

export type DicomTags = Readonly<Record<string, unknown>>

// https://orthanc.uclouvain.be/api/
export class SyntheticPacs {
	private readonly authorization: string

	constructor(
		private readonly url: string,
		user: string,
		password: string,
	) {
		this.authorization = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
	}

	async instanceIdOf(sopInstanceUid: string): Promise<string> {
		const response = await this.request("/tools/find", {
			method: "POST",
			headers: { "Content-Type": JSON_CONTENT_TYPE },
			body: JSON.stringify({ Level: INSTANCE_LEVEL, Query: { SOPInstanceUID: sopInstanceUid } }),
		})
		const ids = (await response.json()) as string[]
		const [id] = ids
		if (ids.length !== 1 || id === undefined) {
			throw new Error(`the synthetic PACS holds ${ids.length} instances ${sopInstanceUid}`)
		}
		return id
	}

	async tagsOf(instanceId: string): Promise<DicomTags> {
		return (await (await this.request(`/instances/${instanceId}/simplified-tags`)).json()) as DicomTags
	}

	async firstFrameOf(instanceId: string): Promise<Buffer> {
		return await this.bytesOf(`/instances/${instanceId}/frames/${FIRST_FRAME}/raw`)
	}

	async encapsulatedDocumentOf(instanceId: string): Promise<Buffer> {
		return await this.bytesOf(`/instances/${instanceId}/content/${ENCAPSULATED_DOCUMENT_TAG}`)
	}

	private async bytesOf(path: string): Promise<Buffer> {
		return Buffer.from(await (await this.request(path)).arrayBuffer())
	}

	private async request(path: string, init: RequestInit = {}): Promise<Response> {
		const response = await fetch(`${this.url}${path}`, {
			...init,
			headers: { ...(init.headers as Record<string, string> | undefined), Authorization: this.authorization },
		})
		if (!response.ok) {
			throw new Error(`the synthetic PACS answered ${response.status} to ${path}: ${await response.text()}`)
		}
		return response
	}
}
