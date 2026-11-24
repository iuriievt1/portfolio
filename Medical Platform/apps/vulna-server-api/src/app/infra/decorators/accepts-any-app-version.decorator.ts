import { SetMetadata } from "@nestjs/common"

export const ACCEPTS_ANY_APP_VERSION = "acceptsAnyAppVersion"

export const AcceptsAnyAppVersion = () => SetMetadata(ACCEPTS_ANY_APP_VERSION, true)
