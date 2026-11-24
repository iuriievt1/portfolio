import { CONFIGURATION_KEY } from "@ansora/contracts"
import type { Configuration } from "@/features/configuration/types/configuration.types"
import type { DraftFilter, DraftQuery, DraftTiming } from "@/features/drafts/types/draft.types"
import { ADMINISTRATION_LOCALE } from "@/lib/format"
import { draftsPagePath } from "@/lib/routes"

// DESIGN.md 9.1
const OPERATOR_PARAM = "operator"
const AGE_PARAM = "age"
export const STALE_AGE = "stale"

const MILLISECONDS_PER_SECOND = 1000
const MILLISECONDS_PER_DAY = 86_400_000
const DAY_UNIT = "day"

const RELATIVE_DAYS = new Intl.RelativeTimeFormat(ADMINISTRATION_LOCALE, { numeric: "auto" })

// CAP-004-R14
export function draftFilterOf(params: URLSearchParams): DraftFilter {
	return {
		operatorUserId: params.get(OPERATOR_PARAM) ?? undefined,
		isStaleOnly: params.get(AGE_PARAM) === STALE_AGE,
	}
}

export function draftFilterParams(filter: DraftFilter): Record<string, string> {
	const params: Record<string, string> = {}
	if (filter.operatorUserId !== undefined) {
		params[OPERATOR_PARAM] = filter.operatorUserId
	}
	if (filter.isStaleOnly) {
		params[AGE_PARAM] = STALE_AGE
	}
	return params
}

function secondsOf(configuration: Configuration | undefined, key: string): number | undefined {
	const value = configuration?.items.find((item) => item.key === key)?.value
	return typeof value === "number" ? value : undefined
}

// CAP-026-R16, stavy-a-mikrocopy.md E97
export function staleDraftsPath(): string {
	return `${draftsPagePath()}?${new URLSearchParams({ [AGE_PARAM]: STALE_AGE })}`
}

// CAP-012-R31
export function draftTimingOf(configuration: Configuration | undefined): DraftTiming {
	return {
		reminderSeconds: secondsOf(configuration, CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS),
		absenceSeconds: secondsOf(configuration, CONFIGURATION_KEY.DRAFT_DISCARD_CONSENT_ABSENCE_SECONDS),
	}
}

// CAP-004-R14, CAP-026-R16
export function draftQueryOf(filter: DraftFilter, reminderSeconds: number | undefined, now: Date): DraftQuery {
	const isAgeKnown = filter.isStaleOnly && reminderSeconds !== undefined
	return {
		operatorUserId: filter.operatorUserId,
		notUpdatedSince: isAgeKnown ? staleBefore(reminderSeconds, now).toISOString() : undefined,
	}
}

function staleBefore(reminderSeconds: number, now: Date): Date {
	return new Date(now.getTime() - reminderSeconds * MILLISECONDS_PER_SECOND)
}

// CAP-015-R18, CAP-026-R16
export function isStale(updatedAt: string, reminderSeconds: number | undefined, now: Date): boolean {
	return reminderSeconds !== undefined && new Date(updatedAt).getTime() <= staleBefore(reminderSeconds, now).getTime()
}

// CAP-015-R19
export function lastLoginText(lastLoginAt: string, now: Date): string {
	const days = Math.floor((now.getTime() - new Date(lastLoginAt).getTime()) / MILLISECONDS_PER_DAY)
	return RELATIVE_DAYS.format(-days, DAY_UNIT)
}
