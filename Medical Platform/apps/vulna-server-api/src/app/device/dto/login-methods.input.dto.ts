import type { AdministrationContract } from "@ansora/contracts"
import { z } from "zod"

export type LoginMethodOverridesInput = AdministrationContract.components["schemas"]["LoginMethodOverrides"]

export type GroupLoginMethodsInput = AdministrationContract.components["schemas"]["GroupLoginMethodsApplication"]

const override = z.boolean().nullable().optional()

// The full account login has no override on any level ✓ CAP-012-R26; a body naming it is refused.
export const loginMethodOverridesSchema = z.strictObject({
	card: override,
	qr: override,
	barcode: override,
	pin: override,
}) satisfies z.ZodType<LoginMethodOverridesInput>

export const groupLoginMethodsSchema = z.strictObject({
	login_methods: loginMethodOverridesSchema,
	clear_device_overrides: z.boolean(),
}) satisfies z.ZodType<GroupLoginMethodsInput>
