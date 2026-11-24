import {
	DEVICE_EVENT_BATCH_MAX_EVENTS,
	DEVICE_EVENT_TYPE,
	DEVICE_EVENT_URL_MAX_LENGTH,
	type DeviceEventBatch,
	LOCAL_DATA_DELETION_REASONS,
} from "@ansora/contracts"
import { z } from "zod"

const originatedAtSchema = z.iso.datetime({ offset: true })

const eventCommon = {
	idempotency_key: z.uuid(),
	originated_at: originatedAtSchema,
	user_id: z.uuid().nullable(),
}

const deviceEventUrlSchema = z.url().max(DEVICE_EVENT_URL_MAX_LENGTH)

// identity.yaml LocalDataDeletionDetails
const localDataDeletionSchema = z.strictObject({
	...eventCommon,
	type: z.literal(DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION),
	details: z.strictObject({
		reason: z.enum(LOCAL_DATA_DELETION_REASONS),
		count: z.int().min(0),
		oldest_acquired_at: originatedAtSchema.nullable(),
	}),
})

// identity.yaml AuthorizationEndpointMismatchDetails
const authorizationEndpointMismatchSchema = z.strictObject({
	...eventCommon,
	type: z.literal(DEVICE_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH),
	details: z.strictObject({
		server_authorization_endpoint: deviceEventUrlSchema,
		provider_authorization_endpoint: deviceEventUrlSchema.nullable(),
		discovery_url: deviceEventUrlSchema,
	}),
})

// CAP-025-R22, identity.yaml DeviceEventBatch
export const deviceEventBatchSchema = z.strictObject({
	events: z
		.array(z.discriminatedUnion("type", [localDataDeletionSchema, authorizationEndpointMismatchSchema]))
		.min(1)
		.max(DEVICE_EVENT_BATCH_MAX_EVENTS)
		.refine((events) => new Set(events.map((event) => event.idempotency_key.toLowerCase())).size === events.length, {
			message: "events repeat an idempotency key",
		}),
}) satisfies z.ZodType<DeviceEventBatch>
