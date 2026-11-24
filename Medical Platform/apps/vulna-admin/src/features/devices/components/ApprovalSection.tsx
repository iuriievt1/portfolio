import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircleIcon } from "@phosphor-icons/react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { Link } from "react-router"
import { errorCodeOf } from "@/api/client"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PageSection } from "@/components/custom/page-section"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { approveDevice } from "@/features/devices/hooks/use-devices"
import { predecessorLinkOf, predecessorText } from "@/features/devices/lib/blocked-predecessor"
import {
	type DeviceApprovalForm,
	type DeviceApprovalValues,
	deviceApprovalSchema,
} from "@/features/devices/lib/device-approval.schema"
import { deviceName } from "@/features/devices/lib/device-label"
import type { BlockedPredecessor, Device } from "@/features/devices/types/device.types"
import { UserPicker } from "@/features/users/components/UserPicker"
import cs from "@/i18n/cs.json"
import { DEVICE_APPROVAL_MESSAGES, errorMessageOf } from "@/lib/error-message"

const texts = cs.devices.approval

const CODE_FIELD_ID = "approval-code"
const REQUESTER_FIELD_ID = "approval-requester"

interface Props {
	device: Device
	onClosed: () => void
}

// CAP-006-R16, CAP-006-R19, DESIGN.md 9.5
export function ApprovalSection({ device, onClosed }: Props) {
	const [open, setOpen] = useState(false)
	const reloadAfterClose = (opened: boolean) => {
		if (!opened) {
			onClosed()
		}
	}

	return (
		<PageSection
			title={texts.heading}
			action={
				<Button size="sm" onClick={() => setOpen(true)}>
					<CheckCircleIcon aria-hidden />
					{texts.action}
				</Button>
			}
		>
			<div className="flex flex-col gap-3">
				<p className="text-sm text-muted-foreground">{texts.description}</p>
				{device.blocked_predecessor === null ? null : <PredecessorNotice predecessor={device.blocked_predecessor} />}
			</div>
			<Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={reloadAfterClose}>
				<DialogContent closeLabel={cs.common.close}>
					<DialogHeader>
						<DialogTitle>{texts.dialogHeading}</DialogTitle>
						<DialogDescription>{deviceName(device)}</DialogDescription>
					</DialogHeader>
					<ApprovalForm deviceId={device.id} onApproved={() => setOpen(false)} />
				</DialogContent>
			</Dialog>
		</PageSection>
	)
}

// CAP-006-R19, CAP-006-S13, CAP-008-R12, E62
function PredecessorNotice({ predecessor }: { predecessor: BlockedPredecessor }) {
	const link = predecessorLinkOf(predecessor)
	const reviewLink =
		link === undefined ? null : (
			<Link to={link.to} className={buttonVariants({ variant: "outline", size: "sm" })}>
				{link.label}
			</Link>
		)
	return (
		<Notice tone={NOTICE_TONE.WARN} action={reviewLink}>
			<span className="block font-medium">{texts.predecessorTitle}</span>
			{predecessorText(predecessor)}
		</Notice>
	)
}

function ApprovalForm({ deviceId, onApproved }: { deviceId: string; onApproved: () => void }) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<DeviceApprovalForm, unknown, DeviceApprovalValues>({
		resolver: zodResolver(deviceApprovalSchema),
		defaultValues: { code: "", requester: undefined },
	})
	const codeError = form.formState.errors.code?.message
	const requesterError = form.formState.errors.requester?.message

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			await approveDevice(deviceId, { fingerprint: values.code, requester_user_id: values.requester.id })
			onApproved()
		} catch (error) {
			if (errorCodeOf(error) === ADMINISTRATION_ERROR_CODE.FINGERPRINT_MISMATCH) {
				form.setError("code", { message: texts.codeMismatch })
				return
			}
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, DEVICE_APPROVAL_MESSAGES)}</Notice>
			)}
			<FormField id={CODE_FIELD_ID} label={texts.codeLabel} hint={texts.codeHint} error={codeError}>
				{(control) => (
					<Input
						id={control.id}
						className="identifier uppercase"
						autoComplete="off"
						autoCapitalize="characters"
						spellCheck={false}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("code")}
					/>
				)}
			</FormField>
			<FormField id={REQUESTER_FIELD_ID} label={texts.requesterLabel} hint={texts.requesterHint} error={requesterError}>
				{(control) => (
					<Controller
						control={form.control}
						name="requester"
						render={({ field }) => (
							<UserPicker
								id={control.id}
								value={field.value}
								onChange={field.onChange}
								invalid={control.invalid}
								describedBy={control.describedBy}
							/>
						)}
					/>
				)}
			</FormField>
			<DialogFooter>
				<DialogClose render={<Button variant="outline" />}>{cs.common.cancel}</DialogClose>
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
