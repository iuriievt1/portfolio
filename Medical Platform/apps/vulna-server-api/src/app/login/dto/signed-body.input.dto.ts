import { z } from "zod"
import { COMPACT_JWS } from "../../../libs/common/constants/jws.constants"
import { SIGNED_BODY_MAX_LENGTH } from "../constants/login-input.constants"

export const signedBodySchema = z.string().regex(COMPACT_JWS).max(SIGNED_BODY_MAX_LENGTH)
