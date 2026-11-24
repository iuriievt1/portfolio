import { CONFIGURATION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"
import cs from "@/i18n/cs.json"
import { fillText } from "@/lib/format"

const texts = cs.configuration.reason

// CAP-012-R19
export const configurationReasonSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(1, texts.missing)
		.max(
			CONFIGURATION_REASON_MAX_LENGTH,
			fillText(cs.errors.tooLong, { max: String(CONFIGURATION_REASON_MAX_LENGTH) }),
		),
})

export type ConfigurationReasonValues = z.infer<typeof configurationReasonSchema>
