import { DELIVERY_INSTANCE_STATES, DELIVERY_STATES } from "@ansora/contracts"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

// administration.yaml listDeliveries
export const deliveryPageSchema = pageSchema.extend({
	state: z.enum(DELIVERY_STATES).optional(),
	instance_state: z.enum(DELIVERY_INSTANCE_STATES).optional(),
})

export type DeliveryPageInput = z.infer<typeof deliveryPageSchema>
