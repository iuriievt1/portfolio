import {
	type AdministrationContract,
	DELIVERY_CLOSURE_NOTE_MAX_LENGTH,
	DELIVERY_CLOSURE_REASONS,
} from "@ansora/contracts"
import { z } from "zod"

type DeliveryClosure = AdministrationContract.components["schemas"]["DeliveryClosure"]

// administration.yaml DeliveryClosure, CAP-023-R28, CAP-023-S26
export const deliveryClosureSchema = z.strictObject({
	reason: z.enum(DELIVERY_CLOSURE_REASONS),
	note: z
		.string()
		.trim()
		.max(DELIVERY_CLOSURE_NOTE_MAX_LENGTH)
		.optional()
		.transform((note) => (note === "" ? undefined : note)),
}) satisfies z.ZodType<DeliveryClosure>

export type DeliveryClosureInput = z.infer<typeof deliveryClosureSchema>
