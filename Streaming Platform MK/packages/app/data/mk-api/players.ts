import type { RailData, RailItemData } from '@pkg/design-system'
import { z } from 'zod'

/** Single person from the MK persons cache (`/discovery/v3/players`). */
const personSchema = z.object({
	Id: z.string().min(1),
	ExternalId: z.string().optional(),
	Name: z.string(),
	FirstName: z.string().optional(),
	LastName: z.string().optional(),
	SupportedImages: z.array(z.string()),
	ImageBucketId: z.string(),
})

export type Person = z.infer<typeof personSchema>

/** Top-level response from `/S1/discovery/v3/players` — a flat array of persons. */
export const personsResponseSchema = z.array(personSchema)

export type PersonsResponse = z.infer<typeof personsResponseSchema>

/** Maps persons to a `character`-variant rail. `href` is a TODO — no destination yet. */
export function mapPersonsToRail(
	feedId: string,
	feedName: string,
	persons: Person[],
	resolveImage: (person: Person) => string,
): RailData {
	const items: RailItemData[] = persons.map((person) => ({
		id: person.Id,
		// TODO: wire to a person detail / filtered search route when a destination exists.
		href: '#',
		title: person.Name,
		imageUrl: resolveImage(person),
		variant: 'character' as const,
	}))

	return { id: feedId, title: feedName, variant: 'character', items }
}
