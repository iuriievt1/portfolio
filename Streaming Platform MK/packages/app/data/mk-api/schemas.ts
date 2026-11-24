import { z } from 'zod'

/** Tenant-specific configuration resolved during boot. */
export type AppConfig = z.infer<typeof appConfigSchema>

/** Zod schema for the tenant-specific configuration resolved during boot. */
export const appConfigSchema = z.object({
	mkApiHost: z.string().min(1),
	tenantId: z.string().min(1),
	storeId: z.string(),
	imageBaseUrl: z.string().min(1),
	groups: z.string(),
	profileId: z.string().min(1),
	locationDetail: z.string(),
	discoveryUrl: z.string().min(1),
	subscriberServiceUrl: z.string().min(1),
	catalogCacheUrl: z.string().min(1),
	searchServiceUrl: z.string(),
	stsServiceUrl: z.string(),
	playerServerUrl: z.string(),
	channelMapId: z.number().nullable(),
	navHubIds: z.object({
		home: z.string().optional().default(''),
	}),
	feedDisplayTypes: z.object({
		jumboFeedIds: z.array(z.string()),
		characterFeedIds: z.array(z.string()),
	}),
	continueWatchingUdl: z.string(),
	favouritesUdl: z.string(),
})
