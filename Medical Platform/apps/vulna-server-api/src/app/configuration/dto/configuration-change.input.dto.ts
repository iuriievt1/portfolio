import { type AdministrationContract, CONFIGURATION_REASON_MAX_LENGTH } from "@ansora/contracts"
import { z } from "zod"

export type ConfigurationChangeInput = AdministrationContract.components["schemas"]["ConfigurationChange"]

const KEY_MAX_LENGTH = 200

export const configurationChangeSchema = z.strictObject({
	expected_version: z.int().min(1),
	reason: z.string().trim().min(1).max(CONFIGURATION_REASON_MAX_LENGTH),
	changes: z.array(z.strictObject({ key: z.string().min(1).max(KEY_MAX_LENGTH), value: z.json() })).min(1),
}) satisfies z.ZodType<ConfigurationChangeInput>
