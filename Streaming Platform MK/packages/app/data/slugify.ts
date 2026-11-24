/** Slugify a hub name: "Action & Adventure" → "action-adventure" */
export function slugifyHub(name: string): string {
	return name
		.toLowerCase()
		.replace(/&/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-+|-+$)/g, '')
}
