import { cs } from "./cs"
import { en } from "./en"
import type { ServerTexts } from "./server-texts"

export type { ServerTexts } from "./server-texts"

// CAP-015-R23
export const SERVER_TEXTS: Readonly<Record<string, ServerTexts>> = {
	[cs.language]: cs,
	[en.language]: en,
}
