const LIKE_SPECIAL = /[\\%_]/g

function likeEscaped(text: string): string {
	return text.replace(LIKE_SPECIAL, (special) => `\\${special}`)
}

export function containing(text: string): string {
	return `%${likeEscaped(text)}%`
}

export function startingWith(text: string): string {
	return `${likeEscaped(text)}%`
}
