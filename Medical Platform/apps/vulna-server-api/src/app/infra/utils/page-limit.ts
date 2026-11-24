import { PAGE_LIMIT_MAX } from "@ansora/contracts"
import type { PageSizePolicy } from "../../configuration/types/configuration.types"

export function pageLimit(requested: number | undefined, policy: PageSizePolicy): number {
	return Math.min(requested ?? policy.defaultSize, policy.maxSize, PAGE_LIMIT_MAX)
}
