import { describe, expect, it } from 'vitest'
import { mapPersonsToRail, type Person, personsResponseSchema } from '../players'

const samplePersons: Person[] = [
	{
		Id: 'ce90f632-40cb-4138-8a98-3df411018b5c',
		ExternalId: 'ce90f632-40cb-4138-8a98-3df411018b5c',
		Name: 'Test 1x1',
		FirstName: 'Test',
		LastName: '1x1',
		SupportedImages: ['1x1/KeyArt'],
		ImageBucketId: 'images',
	},
	{
		Id: 'cf3150d0-670b-4080-a3d9-7baffa1e4c16',
		ExternalId: '052c69b3-91a2-4244-811c-cff9ef96a3ea',
		Name: 'Cale Makar',
		FirstName: 'Cale',
		LastName: 'Makar',
		SupportedImages: ['1x1/KeyArt', '16x9/KeyArt'],
		ImageBucketId: 'images',
	},
	{
		Id: '611942',
		ExternalId: 'e440e013-e817-11e2-a133-f4ce4684ea4c',
		Name: 'Nathan MacKinnon',
		FirstName: 'Nathan',
		LastName: 'MacKinnon',
		SupportedImages: ['1x1/KeyArt', '16x9/KeyArt'],
		ImageBucketId: 'images',
	},
]

describe('personsResponseSchema', () => {
	it('parses a valid persons response with all sample fields', () => {
		const result = personsResponseSchema.safeParse(samplePersons)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data).toHaveLength(3)
			expect(result.data[0].Id).toBe('ce90f632-40cb-4138-8a98-3df411018b5c')
			expect(result.data[0].Name).toBe('Test 1x1')
		}
	})

	it('accepts persons missing optional fields (FirstName, LastName, ExternalId)', () => {
		const minimal = [
			{
				Id: 'minimal-1',
				Name: 'Minimal Person',
				SupportedImages: ['1x1/KeyArt'],
				ImageBucketId: 'images',
			},
		]

		const result = personsResponseSchema.safeParse(minimal)

		expect(result.success).toBe(true)
	})

	it('strips extra fields not consumed by the client', () => {
		const withExtras = [
			{
				...samplePersons[0],
				Biography: [{ Culture: 'en-us', Value: 'bio' }],
				BiographyDetails: { Height: 71 },
				SportSeasons: [{ Year: 2023, Type: 'REG' }],
				Type: 'Sports',
				SportsType: 'Ice hockey',
			},
		]

		const result = personsResponseSchema.safeParse(withExtras)

		expect(result.success).toBe(true)
		if (result.success) {
			expect('Biography' in result.data[0]).toBe(false)
			expect('SportSeasons' in result.data[0]).toBe(false)
		}
	})

	it('rejects a person missing required Id', () => {
		const broken = [{ Name: 'No Id', SupportedImages: [], ImageBucketId: 'images' }]

		const result = personsResponseSchema.safeParse(broken)

		expect(result.success).toBe(false)
	})

	it('rejects a non-array response', () => {
		const result = personsResponseSchema.safeParse({ Items: samplePersons })

		expect(result.success).toBe(false)
	})
})

describe('mapPersonsToRail', () => {
	const resolveImage = (p: Person) => `https://images.test/${p.Id}.jpg`

	it('emits a rail with character variant and the given feed metadata', () => {
		const rail = mapPersonsToRail('feed-1', 'Test 1x1', samplePersons, resolveImage)

		expect(rail.id).toBe('feed-1')
		expect(rail.title).toBe('Test 1x1')
		expect(rail.variant).toBe('character')
	})

	it('maps each person to id/title/href/imageUrl with character variant', () => {
		const rail = mapPersonsToRail('feed-1', 'Test 1x1', [samplePersons[0]], resolveImage)

		expect(rail.items).toHaveLength(1)
		expect(rail.items[0]).toEqual({
			id: 'ce90f632-40cb-4138-8a98-3df411018b5c',
			title: 'Test 1x1',
			imageUrl: 'https://images.test/ce90f632-40cb-4138-8a98-3df411018b5c.jpg',
			href: '#',
			variant: 'character',
		})
	})

	it('returns an empty items array when given no persons', () => {
		const rail = mapPersonsToRail('feed-1', 'Test 1x1', [], resolveImage)

		expect(rail.items).toEqual([])
	})
})
