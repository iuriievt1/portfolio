import { QUEUE_STATE_KEYS_MAX } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

const KEY_SEPARATOR = ","

// clinical-workflow.yaml getQueueState, CAP-019-R30
export const queueStateQuerySchema = pageSchema.extend({
	acquisition_keys: z
		.string()
		.transform((keys) => keys.split(KEY_SEPARATOR))
		.pipe(
			z
				.array(z.uuid())
				.min(1)
				.max(QUEUE_STATE_KEYS_MAX)
				.refine((keys) => new Set(keys).size === keys.length, { message: "acquisition_keys repeat a key" }),
		)
		.optional(),
})

export type QueueStateQueryInput = z.infer<typeof queueStateQuerySchema>
