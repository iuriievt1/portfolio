import { DELIVERY_TARGET_STATE } from "@ansora/contracts"
import { useRef } from "react"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CONFIGURATION_SECTION, CONFIGURATION_TAB } from "@/features/configuration/constants/configuration-fields"
import { TARGET_STATE_TONE } from "@/features/deliveries/constants/delivery-tone"
import { resumeDeliveryTarget, useDeliveryTargets } from "@/features/deliveries/hooks/use-deliveries"
import { targetStateText } from "@/features/deliveries/lib/delivery-text"
import type { DeliveryTarget } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"
import { TARGET_RESUMPTION_MESSAGES } from "@/lib/error-message"
import { fillText, formatDateTime } from "@/lib/format"
import { liveRefreshText } from "@/lib/live-refresh"
import { configurationPagePath } from "@/lib/routes"
import { ActionNotice } from "./ActionNotice"

const texts = cs.deliveries.target

// CAP-023-R23, CAP-023-R24, CAP-023-R27, NAB-397, NAB-534
export function DeliveryTargetsCard() {
	const targets = useDeliveryTargets()
	return (
		<Card className="gap-0 py-0">
			<PageSection
				title={texts.heading}
				description={liveRefreshText()}
				action={
					<RowLink to={configurationPagePath(CONFIGURATION_TAB.INTEGRATIONS, CONFIGURATION_SECTION.PACS)}>
						{texts.settings}
					</RowLink>
				}
			>
				<TargetsContent targets={targets.data} hasFailed={targets.error !== undefined} onChanged={targets.reload} />
			</PageSection>
		</Card>
	)
}

interface ContentProps {
	targets: readonly DeliveryTarget[] | undefined
	hasFailed: boolean
	onChanged: () => void
}

// DESIGN.md 9.6
function TargetsContent({ targets, hasFailed, onChanged }: ContentProps) {
	if (targets === undefined) {
		if (hasFailed) {
			return <Notice tone={NOTICE_TONE.WARN}>{texts.loadFailed}</Notice>
		}
		return (
			<div role="status">
				<span className="sr-only">{cs.common.loading}</span>
				<Skeleton aria-hidden className="h-16" />
			</div>
		)
	}
	if (targets.length === 0) {
		return <p className="text-sm text-muted-foreground">{texts.empty}</p>
	}
	return (
		<div className="flex flex-col gap-4">
			{hasFailed ? <Notice tone={NOTICE_TONE.WARN}>{texts.refreshFailed}</Notice> : null}
			<ul aria-label={texts.label} className="flex flex-col gap-4">
				{targets.map((target) => (
					<TargetItem key={target.code} target={target} onChanged={onChanged} />
				))}
			</ul>
		</div>
	)
}

function TargetItem({ target, onChanged }: { target: DeliveryTarget; onChanged: () => void }) {
	const item = useRef<HTMLLIElement>(null)
	const changed = () => {
		onChanged()
		item.current?.focus()
	}
	return (
		<li ref={item} tabIndex={-1} className="flex flex-col gap-3 outline-hidden">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<span className="identifier font-medium">{target.code}</span>
				<StatusPill tone={TARGET_STATE_TONE[target.state]}>{targetStateText(target.state)}</StatusPill>
				<span className="text-xs text-muted-foreground">
					{fillText(texts.since, { time: formatDateTime(target.changed_at) })}
				</span>
			</div>
			<TargetState target={target} onChanged={changed} />
		</li>
	)
}

// stavy-a-mikrocopy.md E44, E46
function TargetState({ target, onChanged }: { target: DeliveryTarget; onChanged: () => void }) {
	switch (target.state) {
		case DELIVERY_TARGET_STATE.PAUSED:
			return (
				<ActionNotice
					tone={NOTICE_TONE.CRITICAL}
					title={texts.pausedTitle}
					body={fillText(texts.pausedBody, { reason: target.reason ?? cs.common.notStated })}
					actionLabel={texts.resume}
					actingLabel={texts.resuming}
					messages={TARGET_RESUMPTION_MESSAGES}
					act={() => resumeDeliveryTarget(target.code)}
					onDone={onChanged}
				/>
			)
		case DELIVERY_TARGET_STATE.UNAVAILABLE:
			return (
				<Notice tone={NOTICE_TONE.WARN}>
					<span className="block font-medium">{texts.unavailableTitle}</span>
					<span className="block">{texts.unavailableBody}</span>
				</Notice>
			)
		case DELIVERY_TARGET_STATE.ACTIVE:
			return <p className="text-sm text-muted-foreground">{texts.activeBody}</p>
		default:
			return target.state satisfies never
	}
}
