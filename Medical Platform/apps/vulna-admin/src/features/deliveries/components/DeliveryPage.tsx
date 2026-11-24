import { DELIVERY_STATE, hasTextRecognitionFailed, isClosableDeliveryInstanceState } from "@ansora/contracts"
import { FileDashedIcon } from "@phosphor-icons/react"
import { useRef } from "react"
import { useParams } from "react-router"
import { DetailFields } from "@/components/custom/detail-fields"
import { EmptyState } from "@/components/custom/empty-state"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection, PageSections } from "@/components/custom/page-section"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { pacsStatusText } from "@/features/acquisitions/lib/acquisition-text"
import { DELIVERY_STATE_TONE } from "@/features/deliveries/constants/delivery-tone"
import { resumeDeliveryVerification, useDelivery } from "@/features/deliveries/hooks/use-deliveries"
import {
	assemblyReasonText,
	closureReasonText,
	deliveryStateText,
	INSTANCE_NOTICE_KIND,
	instanceDisplayOf,
	instanceNoticeOf,
	recordText,
} from "@/features/deliveries/lib/delivery-text"
import type { Delivery, DeliveryInstance } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { VERIFICATION_RESUMPTION_MESSAGES } from "@/lib/error-message"
import { fillText, formatCount, formatDateTime } from "@/lib/format"
import { liveRefreshText } from "@/lib/live-refresh"
import { requestFailure } from "@/lib/request-failure"
import { acquisitionPagePath, deliveriesPagePath, userPagePath } from "@/lib/routes"
import { ActionNotice } from "./ActionNotice"
import { CloseInstanceAction } from "./CloseInstanceAction"
import { RestartTextRecognitionAction } from "./RestartTextRecognitionAction"

const texts = cs.deliveries
const detailTexts = texts.detail

const DELIVERIES_CRUMB = { to: deliveriesPagePath(), label: texts.heading }

type Closure = NonNullable<DeliveryInstance["closure"]>

// CAP-028-R12, NAB-345, NAB-398, NAB-534, DESIGN.md 9.3
export function DeliveryPage() {
	const { deliveryId = "" } = useParams()
	const delivery = useDelivery(deliveryId)
	useShellTitle(delivery.data === undefined ? detailTexts.heading : recordText(delivery.data), DELIVERIES_CRUMB)

	if (delivery.data === undefined) {
		return (
			<PagePending
				failure={requestFailure(delivery.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={delivery.reload}
			/>
		)
	}

	return (
		<PageSections narrow>
			<PageSection title={detailTexts.delivery}>
				<DeliveryDetails
					delivery={delivery.data}
					hasRefreshFailed={delivery.error !== undefined}
					onChanged={delivery.reload}
				/>
			</PageSection>
			<PageSection title={detailTexts.instances} description={detailTexts.instancesHint} flush>
				<Instances delivery={delivery.data} onChanged={delivery.reload} />
			</PageSection>
			<p className="px-(--card-p) py-3 text-xs text-muted-foreground">{liveRefreshText()}</p>
		</PageSections>
	)
}

function reasonValue(reason: string) {
	return assemblyReasonText(reason) ?? <span className="identifier">{reason}</span>
}

interface DeliveryDetailsProps {
	delivery: Delivery
	hasRefreshFailed: boolean
	onChanged: () => void
}

// CAP-022-R15, NAB-398
function DeliveryDetails({ delivery, hasRefreshFailed, onChanged }: DeliveryDetailsProps) {
	const details = useRef<HTMLDivElement>(null)
	return (
		<div ref={details} tabIndex={-1} className="flex flex-col gap-3 outline-hidden">
			{hasRefreshFailed ? <Notice tone={NOTICE_TONE.WARN}>{detailTexts.refreshFailed}</Notice> : null}
			<DetailFields fields={deliveryFieldsOf(delivery)} />
			{hasTextRecognitionFailed(delivery.state, delivery.reason) ? (
				<RestartTextRecognitionAction deliveryId={delivery.delivery_id} returnFocus={details} onRestarted={onChanged} />
			) : null}
		</div>
	)
}

function deliveryFieldsOf(delivery: Delivery) {
	const fields = [
		{
			term: detailTexts.acquisition,
			value: (
				<span className="flex flex-col items-start gap-1">
					<RowLink to={acquisitionPagePath(delivery.acquisition_id)}>{recordText(delivery)}</RowLink>
					<span className="identifier select-all break-all text-xs text-muted-foreground">
						{delivery.acquisition_id}
					</span>
				</span>
			),
		},
		{ term: detailTexts.target, value: <span className="identifier">{delivery.target}</span> },
		{
			term: detailTexts.state,
			value: <StatusPill tone={DELIVERY_STATE_TONE[delivery.state]}>{deliveryStateText(delivery.state)}</StatusPill>,
		},
	]
	if (delivery.reason === null) {
		return fields
	}
	return [...fields, { term: detailTexts.reason, value: reasonValue(delivery.reason) }]
}

function Instances({ delivery, onChanged }: { delivery: Delivery; onChanged: () => void }) {
	if (delivery.instance.length === 0) {
		const hasFailed = delivery.state === DELIVERY_STATE.ASSEMBLY_FAILED
		return (
			<EmptyState
				icon={<FileDashedIcon weight="bold" className="size-5" />}
				title={hasFailed ? detailTexts.instancesEmptyFailed : detailTexts.instancesEmpty}
				description={hasFailed ? detailTexts.instancesEmptyFailedHint : detailTexts.instancesEmptyHint}
			/>
		)
	}
	return (
		<ul aria-label={detailTexts.instancesTable} className="divide-y border-t">
			{delivery.instance.map((instance, index) => (
				<InstanceItem
					key={instance.instance_id}
					deliveryId={delivery.delivery_id}
					instance={instance}
					number={formatCount(index + 1)}
					onChanged={onChanged}
				/>
			))}
		</ul>
	)
}

interface InstanceItemProps {
	deliveryId: string
	instance: DeliveryInstance
	number: string
	onChanged: () => void
}

function InstanceItem({ deliveryId, instance, number, onChanged }: InstanceItemProps) {
	const item = useRef<HTMLLIElement>(null)
	const display = instanceDisplayOf(instance)
	const changed = () => {
		onChanged()
		item.current?.focus()
	}
	return (
		<li ref={item} tabIndex={-1} className="flex flex-col gap-3 px-(--card-p) py-4 outline-hidden">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="flex flex-wrap items-center gap-2">
					<h3 className="font-medium">{fillText(detailTexts.instance, { number })}</h3>
					<StatusPill tone={display.tone}>{display.label}</StatusPill>
				</span>
				{isClosableDeliveryInstanceState(instance.state) ? (
					<CloseInstanceAction
						deliveryId={deliveryId}
						instanceId={instance.instance_id}
						instanceNumber={number}
						returnFocus={item}
						onClosed={onChanged}
					/>
				) : null}
			</div>
			<InstanceExplanation deliveryId={deliveryId} instance={instance} onChanged={changed} />
			<DetailFields fields={instanceFieldsOf(instance)} />
			{instance.closure === null ? null : <ClosureDetails closure={instance.closure} />}
		</li>
	)
}

function valueOrNotStated(value: string | null) {
	return value === null ? cs.common.notStated : <span className="identifier break-all">{value}</span>
}

// CAP-023-R15, CAP-026-R03, CAP-023-R26
function instanceFieldsOf(instance: DeliveryInstance) {
	const fields = [
		{ term: detailTexts.artifact, value: <span className="identifier break-all">{instance.artifact_id}</span> },
		{ term: detailTexts.attempts, value: <span className="num">{formatCount(instance.attempts)}</span> },
		{ term: detailTexts.lastStatus, value: valueOrNotStated(instance.last_dimse_status) },
		{ term: detailTexts.transferSyntax, value: valueOrNotStated(instance.accepted_transfer_syntax) },
		{
			term: detailTexts.retentionAnchor,
			value: instance.retention_anchor === null ? cs.common.notStated : formatDateTime(instance.retention_anchor),
		},
	]
	if (instance.verification_rejections === 0) {
		return fields
	}
	return [
		...fields,
		{
			term: detailTexts.verificationRejections,
			value: <span className="num">{formatCount(instance.verification_rejections)}</span>,
		},
	]
}

interface InstanceExplanationProps {
	deliveryId: string
	instance: DeliveryInstance
	onChanged: () => void
}

// CAP-023-R09, CAP-023-R12, CAP-023-R26, stavy-a-mikrocopy.md E63, E64, E65
function InstanceExplanation({ deliveryId, instance, onChanged }: InstanceExplanationProps) {
	const notice = instanceNoticeOf(instance)
	if (notice === undefined) {
		return null
	}
	if (notice.kind === INSTANCE_NOTICE_KIND.VERIFICATION_ON_HOLD) {
		return (
			<ActionNotice
				tone={NOTICE_TONE.WARN}
				title={detailTexts.explanation.verificationOnHoldTitle}
				body={notice.text}
				actionLabel={detailTexts.resumeVerification}
				actingLabel={detailTexts.resumingVerification}
				messages={VERIFICATION_RESUMPTION_MESSAGES}
				act={() => resumeDeliveryVerification(deliveryId, instance.instance_id)}
				onDone={onChanged}
			/>
		)
	}
	return (
		<Notice tone={notice.tone}>
			{notice.title === undefined ? null : <span className="block font-medium">{notice.title}</span>}
			<span className="block">{notice.text}</span>
		</Notice>
	)
}

// CAP-023-R28, CAP-023-S24
function ClosureDetails({ closure }: { closure: Closure }) {
	const closureTexts = detailTexts.closure
	return (
		<div className="flex flex-col gap-2 rounded-lg border p-(--card-p)">
			<h4 className="text-sm font-semibold">{closureTexts.heading}</h4>
			<DetailFields
				fields={[
					{ term: closureTexts.reason, value: closureReasonText(closure.reason) },
					{ term: closureTexts.from, value: pacsStatusText(closure.closed_from_state) },
					{ term: closureTexts.at, value: formatDateTime(closure.closed_at) },
					{
						term: closureTexts.by,
						value: <RowLink to={userPagePath(closure.closed_by_user_id)}>{closureTexts.openUser}</RowLink>,
					},
				]}
			/>
			{closure.set_aside_data_deleted_at === null ? (
				<p className="text-sm text-muted-foreground">{closureTexts.setAside}</p>
			) : null}
		</div>
	)
}
