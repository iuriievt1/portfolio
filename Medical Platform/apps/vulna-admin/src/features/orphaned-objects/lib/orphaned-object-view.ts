const SHORT_OBJECT_ID_LENGTH = 8
const ELLIPSIS = "…"

// stavy-a-mikrocopy.md E67
export function shortObjectIdOf(objectId: string): string {
	return `${objectId.slice(0, SHORT_OBJECT_ID_LENGTH)}${ELLIPSIS}`
}
