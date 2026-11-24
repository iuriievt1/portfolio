import { SetMetadata } from "@nestjs/common"
import { ACCEPTS_EXPIRED_TOKEN } from "../constants/user-session.constants"

// ADR-013
export const AcceptsExpiredToken = () => SetMetadata(ACCEPTS_EXPIRED_TOKEN, true)
