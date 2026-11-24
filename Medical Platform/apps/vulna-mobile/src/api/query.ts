type QueryValue = string | number | undefined

export function withQuery(path: string, parameters: Readonly<Record<string, QueryValue>>): string {
	const present = Object.entries(parameters).filter(
		(entry): entry is [string, string | number] => entry[1] !== undefined,
	)
	if (present.length === 0) {
		return path
	}
	const query = new URLSearchParams(present.map(([name, value]) => [name, String(value)]))
	return `${path}?${query.toString()}`
}
