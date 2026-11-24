import { AUDIT_EXPORT_FAILURE } from "@ansora/contracts"
import { PaperPlaneTiltIcon } from "@phosphor-icons/react"
import { LoadFailure } from "@/components/custom/load-failure"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { RowLink } from "@/components/custom/row-link"
import { PILL_TONE, type PillTone, StatusPill } from "@/components/custom/status-pill"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuditExportStatus } from "@/features/audit/hooks/use-audit"
import { exportFailureText } from "@/features/audit/lib/audit-text"
import type { AuditExportStatus } from "@/features/audit/types/audit.types"
import { CONFIGURATION_SECTION, CONFIGURATION_TAB } from "@/features/configuration/constants/configuration-fields"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount, formatDateTime } from "@/lib/format"
import { configurationPagePath } from "@/lib/routes"
import { StatusRow } from "./StatusRow"

const texts = cs.audit.syslog

// CAP-025-R08, CAP-025-R09, CAP-025-S03
export function SyslogExportSection() {
	const status = useAuditExportStatus()

	if (status.data === undefined) {
		return (
			<StatusRow icon={<PaperPlaneTiltIcon aria-hidden className="size-4" />} title={texts.heading}>
				{status.error === undefined ? (
					<div role="status" className="flex-1">
						<span className="sr-only">{cs.common.loading}</span>
						<Skeleton aria-hidden className="h-5 max-w-xs" />
					</div>
				) : (
					<LoadFailure title={errorMessageOf(status.error)} retryLabel={cs.errors.retry} onRetry={status.reload} />
				)}
			</StatusRow>
		)
	}
	return <ExportStatus status={status.data} />
}

function stateOf(configured: boolean, failingSince: string | undefined): { tone: PillTone; text: string } {
	if (!configured) {
		return { tone: PILL_TONE.WARN, text: texts.state.notConfigured }
	}
	if (failingSince !== undefined) {
		return { tone: PILL_TONE.CRITICAL, text: texts.state.failing }
	}
	return { tone: PILL_TONE.NEUTRAL, text: texts.state.running }
}

function ExportStatus({ status }: { status: AuditExportStatus }) {
	const failingSince = status.failing_since ?? undefined
	const state = stateOf(status.configured, failingSince)
	const exportedAt = status.exported_at ?? undefined
	return (
		<StatusRow
			icon={<PaperPlaneTiltIcon aria-hidden className="size-4" />}
			title={texts.heading}
			action={
				<RowLink to={configurationPagePath(CONFIGURATION_TAB.INTEGRATIONS, CONFIGURATION_SECTION.SYSLOG)}>
					{status.configured ? texts.settings : texts.configure}
				</RowLink>
			}
			notices={
				<>
					{failingSince === undefined ? null : (
						<Notice tone={NOTICE_TONE.CRITICAL}>
							{fillText(texts.failing, {
								time: formatDateTime(failingSince),
								reason: exportFailureText(status.last_failure ?? AUDIT_EXPORT_FAILURE.FAILED),
							})}
						</Notice>
					)}
					{status.pending_count <= status.buffer_limit ? null : (
						<Notice tone={NOTICE_TONE.CRITICAL}>
							{fillText(texts.overLimit, { limit: formatCount(status.buffer_limit) })}
						</Notice>
					)}
				</>
			}
		>
			<StatusPill tone={state.tone}>{state.text}</StatusPill>
			<span className="text-sm text-muted-foreground">
				{fillText(texts.summary, {
					pending: formatCount(status.pending_count),
					exportedAt: exportedAt === undefined ? cs.common.never : formatDateTime(exportedAt),
				})}
			</span>
		</StatusRow>
	)
}
