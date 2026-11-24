import { SetMetadata } from "@nestjs/common"
import { KEEPS_IDLE_TIME } from "../constants/administration-session.constants"

// CAP-004-R11
export const KeepsIdleTime = () => SetMetadata(KEEPS_IDLE_TIME, true)
