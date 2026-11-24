import { DELIVERY_CLOSURE_NOTE_MAX_LENGTH, DELIVERY_CLOSURE_REASONS } from "@ansora/contracts"
import { z } from "zod"
import type { DeliveryClosure } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

// CAP-023-R28, CAP-023-S26, administration.yaml DeliveryClosure
export const deliveryClosureSchema = z.object({
	reason: z.enum(DELIVERY_CLOSURE_REASONS, { error: cs.deliveries.closeDialog.reasonMissing }),
	note: z
		.string()
		.trim()
		.max(
			DELIVERY_CLOSURE_NOTE_MAX_LENGTH,
			fillText(cs.errors.tooLong, { max: String(DELIVERY_CLOSURE_NOTE_MAX_LENGTH) }),
		),
})

export type DeliveryClosureValues = z.infer<typeof deliveryClosureSchema>

// administration.yaml DeliveryClosure.note
export function deliveryClosureOf(values: DeliveryClosureValues): DeliveryClosure {
	return values.note === "" ? { reason: values.reason } : { reason: values.reason, note: values.note }
}
