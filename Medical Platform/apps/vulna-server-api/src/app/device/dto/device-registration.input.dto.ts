import { z } from "zod"
import { COMPACT_JWS } from "../../../libs/common/constants/jws.constants"
import type { DeviceRegistrationInput } from "../types/device.types"

const JWS_MAX_LENGTH = 16_384

export const deviceRegistrationSchema = z.strictObject({
	jws: z.string().regex(COMPACT_JWS).max(JWS_MAX_LENGTH),
}) satisfies z.ZodType<DeviceRegistrationInput>

export type DeviceRegistrationDto = DeviceRegistrationInput
