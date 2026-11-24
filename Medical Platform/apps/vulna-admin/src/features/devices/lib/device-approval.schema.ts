import { DEVICE_FINGERPRINT_PATTERN } from "@ansora/contracts"
import { z } from "zod"
import type { User } from "@/features/users/types/user.types"
import cs from "@/i18n/cs.json"

const texts = cs.devices.approval

const CODE_GROUP_LENGTH = 5
const CODE_LENGTH = 2 * CODE_GROUP_LENGTH
const SEPARATORS = /[\s-]/g
// Crockford base32
const CROCKFORD_ALIASES: Readonly<Record<string, string>> = { O: "0", I: "1", L: "1" }
const ALIAS = /[OIL]/g

export const deviceApprovalSchema = z.object({
	code: z.string().transform(normalizedCode).pipe(z.string().regex(DEVICE_FINGERPRINT_PATTERN, texts.codeInvalid)),
	requester: z.custom<User>((value) => value !== undefined, texts.requesterMissing),
})

export type DeviceApprovalForm = z.input<typeof deviceApprovalSchema>

export type DeviceApprovalValues = z.output<typeof deviceApprovalSchema>

function normalizedCode(code: string): string {
	const characters = code
		.toUpperCase()
		.replace(SEPARATORS, "")
		.replace(ALIAS, (alias) => CROCKFORD_ALIASES[alias] ?? alias)
	if (characters.length !== CODE_LENGTH) {
		return characters
	}
	return `${characters.slice(0, CODE_GROUP_LENGTH)}-${characters.slice(CODE_GROUP_LENGTH)}`
}
