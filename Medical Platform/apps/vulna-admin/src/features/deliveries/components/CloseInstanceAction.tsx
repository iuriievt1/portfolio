import { DELIVERY_CLOSURE_REASONS } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { type RefObject, useState } from "react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { closeDeliveryInstance } from "@/features/deliveries/hooks/use-deliveries"
import {
	type DeliveryClosureValues,
	deliveryClosureOf,
	deliveryClosureSchema,
} from "@/features/deliveries/lib/delivery-closure.schema"
import { closureReasonText } from "@/features/deliveries/lib/delivery-text"
import cs from "@/i18n/cs.json"
import { DELIVERY_CLOSURE_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText } from "@/lib/format"
import { DeliveryActionDialog, type PerformAction } from "./DeliveryActionDialog"

const texts = cs.deliveries.closeDialog

const NO_REASON = ""
const FIELD_ID = {
	REASON: "delivery-closure-reason",
	NOTE: "delivery-closure-note",
} as const

interface Props {
	deliveryId: string
	instanceId: string
	instanceNumber: string
	returnFocus: RefObject<HTMLElement | null>
	onClosed: () => void
}

// CAP-023-R28, CAP-023-S24, CAP-023-S26, stavy-a-mikrocopy.md E78, DESIGN.md 9.5
export function CloseInstanceAction({ deliveryId, instanceId, instanceNumber, returnFocus, onClosed }: Props) {
	return (
		<DeliveryActionDialog
			trigger={
				<>
					{cs.deliveries.detail.close}
					<span className="sr-only">{fillText(cs.deliveries.detail.instanceAction, { number: instanceNumber })}</span>
				</>
			}
			title={fillText(texts.heading, { number: instanceNumber })}
			description={texts.body}
			returnFocus={returnFocus}
			onDone={onClosed}
		>
			{(perform) => <CloseInstanceForm deliveryId={deliveryId} instanceId={instanceId} perform={perform} />}
		</DeliveryActionDialog>
	)
}

interface FormProps {
	deliveryId: string
	instanceId: string
	perform: PerformAction
}

function CloseInstanceForm({ deliveryId, instanceId, perform }: FormProps) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<DeliveryClosureValues>({
		resolver: zodResolver(deliveryClosureSchema),
		defaultValues: { reason: NO_REASON as DeliveryClosureValues["reason"], note: "" },
	})
	const errors = form.formState.errors
	const isSubmitting = form.formState.isSubmitting

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			await perform(() => closeDeliveryInstance(deliveryId, instanceId, deliveryClosureOf(values)))
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, DELIVERY_CLOSURE_MESSAGES)}</Notice>
			)}
			<FormField id={FIELD_ID.REASON} label={texts.reason} error={errors.reason?.message}>
				{(control) => (
					<NativeSelect
						id={control.id}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("reason")}
					>
						<option value={NO_REASON} disabled>
							{texts.reasonPlaceholder}
						</option>
						{DELIVERY_CLOSURE_REASONS.map((reason) => (
							<option key={reason} value={reason}>
								{closureReasonText(reason)}
							</option>
						))}
					</NativeSelect>
				)}
			</FormField>
			<FormField id={FIELD_ID.NOTE} label={texts.note} hint={texts.noteHint} error={errors.note?.message}>
				{(control) => (
					<Textarea
						id={control.id}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("note")}
					/>
				)}
			</FormField>
			<DialogFooter>
				<DialogClose disabled={isSubmitting} render={<Button variant="outline" />}>
					{cs.common.cancel}
				</DialogClose>
				<Button type="submit" variant="destructive" disabled={isSubmitting}>
					{isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
