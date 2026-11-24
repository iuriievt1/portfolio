import type { Permission } from "@ansora/core-server"
import { SetMetadata } from "@nestjs/common"
import { REQUIRED_PERMISSION } from "../constants/administration-session.constants"

// CAP-003-R13
export const RequiresPermission = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION, permission)
