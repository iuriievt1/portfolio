import { zodResolver } from "@hookform/resolvers/zod"
import { LockOpenIcon } from "@phosphor-icons/react"
import { type RefObject, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { DetailFields } from "@/components/custom/detail-fields"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { RowLink } from "@/components/custom/row-link"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { BLOCKED, REVOKED } from "@/features/devices/constants/device-state"
import { unblockDevice } from "@/features/devices/hooks/use-devices"
import { deviceName } from "@/features/devices/lib/device-label"
import { type DeviceUnblockingValues, deviceUnblockingSchema } from "@/features/devices/lib/device-unblocking.schema"
import { signalsText } from "@/features/devices/lib/integrity-signals"
import type { BlockingReview, Device, DeviceUnblockingRecord } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { DEVICE_UNBLOCKING_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatDateTime } from "@/lib/format"
import { userPagePath } from "@/lib/routes"

const texts = cs.devices.blocking

const REASON_FIELD_ID = "unblocking-reason"

interface Props {
	device: Device
	onClosed: () => void
}

// CAP-007-R06, CAP-007-S07, CAP-008-R07, CAP-008-R12, CAP-008-S09, E43
export function DeviceBlockingSection({ device, onClosed }: Props) {
	const content = useRef<HTMLDivElement>(null)
	if (device.state !== BLOCKED && device.state !== REVOKED) {
		return null
	}
	const review = device.blocking
	const unblocking = device.unblocking
	const afterUnblocking = review === null ? texts.afterUnreported : texts.afterBlocking
	return (
		<PageSection
			title={review === null ? texts.unreportedHeading : texts.heading}
			action={
				unblocking === null ? (
					<UnblockAction
						device={device}
						afterUnblocking={afterUnblocking}
						sectionContent={content}
						onClosed={onClosed}
					/>
				) : undefined
			}
		>
			<div ref={content} tabIndex={-1} className="flex flex-col gap-3 outline-hidden">
				{device.state === BLOCKED ? <Notice tone={NOTICE_TONE.CRITICAL}>{texts.notice}</Notice> : null}
				{review === null ? null : <Review review={review} />}
				{unblocking === null && review === null ? (
					<p className="text-sm text-muted-foreground">{texts.unreportedHint}</p>
				) : null}
				{unblocking === null ? null : <UnblockingDone unblocking={unblocking} afterUnblocking={afterUnblocking} />}
			</div>
		</PageSection>
	)
}

function Review({ review }: { review: BlockingReview }) {
	return (
		<>
			<DetailFields
				fields={[
					{ term: texts.detectedAt, value: formatDateTime(review.detected_at) },
					{ term: texts.signals, value: signalsText(review.signals) },
					{ term: texts.appVersion, value: <span className="identifier break-all">{review.app_version}</span> },
				]}
			/>
			<p className="text-sm text-muted-foreground">{texts.reportScope}</p>
		</>
	)
}

interface UnblockingDoneProps {
	unblocking: DeviceUnblockingRecord
	afterUnblocking: string
}

function UnblockingDone({ unblocking, afterUnblocking }: UnblockingDoneProps) {
	return (
		<>
			<DetailFields
				fields={[
					{ term: texts.unblockedAt, value: formatDateTime(unblocking.unblocked_at) },
					{
						term: texts.unblockedBy,
						value: <RowLink to={userPagePath(unblocking.unblocked_by_user_id)}>{texts.openUser}</RowLink>,
					},
					{
						term: texts.reasonLabel,
						value: <span className="whitespace-pre-line break-words">{unblocking.reason}</span>,
					},
				]}
			/>
			<p className="text-sm text-muted-foreground">{afterUnblocking}</p>
		</>
	)
}

interface UnblockActionProps {
	device: Device
	afterUnblocking: string
	sectionContent: RefObject<HTMLElement | null>
	onClosed: () => void
}

// DESIGN.md 8.2, DESIGN.md 9.5
function UnblockAction({ device, afterUnblocking, sectionContent, onClosed }: UnblockActionProps) {
	const [open, setOpen] = useState(false)
	const [isUnblocking, setIsUnblocking] = useState(false)
	const isUnblocked = useRef(false)

	const changeOpen = (next: boolean) => {
		if (!isUnblocking) {
			setOpen(next)
		}
	}

	const reloadAfterClose = (opened: boolean) => {
		if (!opened) {
			onClosed()
		}
	}

	const focusAfterClose = () => (isUnblocked.current ? sectionContent.current : true)

	const unblock = async (reason: string) => {
		setIsUnblocking(true)
		try {
			await unblockDevice(device.id, { reason })
			isUnblocked.current = true
			setOpen(false)
		} finally {
			setIsUnblocking(false)
		}
	}

	return (
		<>
			<Button size="sm" variant="outline" onClick={() => setOpen(true)}>
				<LockOpenIcon aria-hidden />
				{texts.action}
			</Button>
			<Dialog open={open} onOpenChange={changeOpen} onOpenChangeComplete={reloadAfterClose}>
				<DialogContent closeLabel={cs.common.close} className="sm:max-w-md" finalFocus={focusAfterClose}>
					<DialogHeader>
						<DialogTitle>{fillText(texts.dialogHeading, { name: deviceName(device) })}</DialogTitle>
						<DialogDescription>{afterUnblocking}</DialogDescription>
					</DialogHeader>
					<UnblockForm onSubmit={unblock} />
				</DialogContent>
			</Dialog>
		</>
	)
}

function UnblockForm({ onSubmit }: { onSubmit: (reason: string) => Promise<void> }) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<DeviceUnblockingValues>({
		resolver: zodResolver(deviceUnblockingSchema),
		defaultValues: { reason: "" },
	})
	const isSubmitting = form.formState.isSubmitting

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			await onSubmit(values.reason)
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, DEVICE_UNBLOCKING_MESSAGES)}</Notice>
			)}
			<FormField
				id={REASON_FIELD_ID}
				label={texts.reasonLabel}
				hint={texts.reasonHint}
				error={form.formState.errors.reason?.message}
			>
				{(control) => (
					<Textarea
						id={control.id}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("reason")}
					/>
				)}
			</FormField>
			<p className="text-sm text-muted-foreground">{texts.audited}</p>
			<DialogFooter>
				<DialogClose disabled={isSubmitting} render={<Button variant="outline" />}>
					{cs.common.cancel}
				</DialogClose>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? texts.submitting : texts.action}
				</Button>
			</DialogFooter>
		</form>
	)
}
