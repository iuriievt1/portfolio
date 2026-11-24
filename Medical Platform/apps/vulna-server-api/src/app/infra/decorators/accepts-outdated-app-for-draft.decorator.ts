import { SetMetadata } from "@nestjs/common"

export const ACCEPTS_OUTDATED_APP_FOR_DRAFT = "acceptsOutdatedAppForDraft"

// CAP-012-R25, index.yaml AppVersion
export const AcceptsOutdatedAppForDraft = () => SetMetadata(ACCEPTS_OUTDATED_APP_FOR_DRAFT, true)
