import { LinkIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import { checkAuditChain, useLatestChainBreak } from "@/features/audit/hooks/use-audit"
import type { AuditChainCheck, AuditRecord } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatDateTime, formatPreciseDateTime } from "@/lib/format"
import { StatusRow } from "./StatusRow"

const texts = cs.audit.chain

const CHAIN_INTACT: AuditChainCheck["outcome"] = "intact"

// CAP-025-R21, CAP-025-S13
export function ChainSection() {
	const latestBreak = useLatestChainBreak()
	const [checking, setChecking] = useState(false)
	const [result, setResult] = useState<AuditChainCheck | undefined>(undefined)
	const [failure, setFailure] = useState<unknown>(undefined)

	const check = () => {
		setChecking(true)
		setFailure(undefined)
		checkAuditChain()
			.then((checked) => {
				setResult(checked)
				latestBreak.reload()
			})
			.catch((reason: unknown) => setFailure(reason))
			.finally(() => setChecking(false))
	}

	const breakEvent = latestBreak.data ?? undefined
	return (
		<StatusRow
			icon={<LinkIcon aria-hidden className="size-4" />}
			title={texts.heading}
			action={
				<Button variant="outline" size="sm" disabled={checking} onClick={check}>
					{checking ? texts.checking : texts.check}
				</Button>
			}
			notices={
				breakEvent === undefined && latestBreak.error === undefined ? undefined : (
					<div className="flex flex-col gap-3">
						{breakEvent === undefined ? null : <ChainBreakNotice event={breakEvent} />}
						{latestBreak.error === undefined ? null : (
							<Notice
								tone={NOTICE_TONE.CRITICAL}
								action={
									<Button variant="outline" size="sm" onClick={latestBreak.reload}>
										{cs.errors.retry}
									</Button>
								}
							>
								{errorMessageOf(latestBreak.error)}
							</Notice>
						)}
					</div>
				)
			}
		>
			<div aria-live="polite">
				<CheckOutcome result={result} failure={failure} />
			</div>
		</StatusRow>
	)
}

function ChainBreakNotice({ event }: { event: AuditRecord }) {
	const brokenRecord = event.audit_chain_check?.first_broken_record_id
	return (
		<Notice tone={NOTICE_TONE.CRITICAL}>
			{fillText(texts.breakFound, { time: formatDateTime(event.time) })}
			{brokenRecord === undefined ? null : <BrokenRecord id={brokenRecord} />}
		</Notice>
	)
}

function BrokenRecord({ id }: { id: string }) {
	return (
		<>
			{" "}
			{texts.firstBroken} <span className="identifier break-all">{id}</span>
		</>
	)
}

function CheckOutcome({ result, failure }: { result: AuditChainCheck | undefined; failure: unknown }) {
	if (failure !== undefined) {
		return <p className="text-sm text-destructive">{errorMessageOf(failure)}</p>
	}
	if (result === undefined) {
		return <p className="text-sm text-muted-foreground">{texts.description}</p>
	}
	if (result.outcome === CHAIN_INTACT) {
		return <p className="text-sm">{fillText(texts.intact, { time: formatPreciseDateTime(result.checked_until) })}</p>
	}
	return (
		<p className="text-sm font-medium text-destructive">
			{texts.broken}
			{result.first_broken_record_id === undefined ? null : <BrokenRecord id={result.first_broken_record_id} />}
		</p>
	)
}
