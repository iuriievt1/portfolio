import {
	type AdministrationContract,
	DEVICE_GROUP_CODE_MAX_LENGTH,
	DEVICE_GROUP_NAME_MAX_LENGTH,
} from "@ansora/contracts"
import { z } from "zod"
import { loginMethodOverridesSchema } from "./login-methods.input.dto"

export type DeviceGroupInput = AdministrationContract.components["schemas"]["DeviceGroupWrite"]

export const deviceGroupSchema = z.strictObject({
	code: z.string().trim().min(1).max(DEVICE_GROUP_CODE_MAX_LENGTH),
	name: z.string().trim().min(1).max(DEVICE_GROUP_NAME_MAX_LENGTH),
	login_methods: loginMethodOverridesSchema.optional(),
}) satisfies z.ZodType<DeviceGroupInput>
