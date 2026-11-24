import { DEVICE_STATE, type DeviceState } from "@ansora/core-server"
import { z } from "zod"
import { pageSchema } from "../../infra/dto/page.input.dto"

export const devicePageSchema = pageSchema.extend({
	state: z.enum(Object.values(DEVICE_STATE) as [DeviceState, ...DeviceState[]]).optional(),
})

export type DevicePageInput = z.infer<typeof devicePageSchema>
