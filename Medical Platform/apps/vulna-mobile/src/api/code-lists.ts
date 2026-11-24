import type { MobileContract } from "@ansora/contracts"
import { ACCEPTS_OUTDATED_APP, callApi, callApiResponse } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type CodeListSet = Schemas["CodeListSet"]
export type CodeListItem = Schemas["CodeListItem"]
export type BodyDiagram = CodeListSet["body_diagram"]
export type BodyDiagramRegion = Schemas["BodyDiagramRegion"]
export type LocalizedNames = Schemas["LocalizedNames"]

const CODE_LISTS_PATH: keyof MobileContract.paths = "/sync/code-lists"

export const codeListApi = {
	// CAP-017-R18, CAP-016-R18, ADR-023, CAP-012-R25
	syncCodeLists: (sessionToken: string, knownVersion: string | undefined): Promise<CodeListSet> =>
		callApi<CodeListSet>(withQuery(CODE_LISTS_PATH, { known_version: knownVersion }), {
			sessionToken,
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-016-R07, CAP-016-R08, CAP-012-R25
	getBodyDiagramBackground: async (sessionToken: string, backgroundUrl: string): Promise<string> =>
		await (await callApiResponse(backgroundUrl, { sessionToken, ...ACCEPTS_OUTDATED_APP })).text(),
}
