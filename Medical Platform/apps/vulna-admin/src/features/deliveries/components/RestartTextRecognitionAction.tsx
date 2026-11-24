import { zodResolver } from "@hookform/resolvers/zod"
import { type RefObject, useState } from "react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { restartTextRecognition } from "@/features/deliveries/hooks/use-deliveries"
import {
	type TextRecognitionRestartValues,
	textRecognitionRestartSchema,
} from "@/features/deliveries/lib/text-recognition-restart.schema"
import cs from "@/i18n/cs.json"
import { errorMessageOf, TEXT_RECOGNITION_RESTART_MESSAGES } from "@/lib/error-message"
import { DeliveryActionDialog, type PerformAction } from "./DeliveryActionDialog"

const texts = cs.deliveries.restartDialog

const REASON_FIELD_ID = "text-recognition-restart-reason"

interface Props {
	deliveryId: string
	returnFocus: RefObject<HTMLElement | null>
	onRestarted: () => void
}

// CAP-022-R15, CAP-022-S06, stavy-a-mikrocopy.md E80, DESIGN.md 9.5
export function RestartTextRecognitionAction({ deliveryId, returnFocus, onRestarted }: Props) {
	return (
		<Notice
			tone={NOTICE_TONE.CRITICAL}
			action={
				<DeliveryActionDialog
					trigger={texts.trigger}
					title={texts.heading}
					description={texts.body}
					returnFocus={returnFocus}
					onDone={onRestarted}
				>
					{(perform) => <RestartForm deliveryId={deliveryId} perform={perform} />}
				</DeliveryActionDialog>
			}
		>
			{texts.noticeBody}
		</Notice>
	)
}

function RestartForm({ deliveryId, perform }: { deliveryId: string; perform: PerformAction }) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<TextRecognitionRestartValues>({
		resolver: zodResolver(textRecognitionRestartSchema),
		defaultValues: { reason: "" },
	})
	const reasonError = form.formState.errors.reason?.message
	const isSubmitting = form.formState.isSubmitting

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			await perform(() => restartTextRecognition(deliveryId, values))
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, TEXT_RECOGNITION_RESTART_MESSAGES)}</Notice>
			)}
			<FormField id={REASON_FIELD_ID} label={texts.reason} hint={texts.reasonHint} error={reasonError}>
				{(control) => (
					<Textarea
						id={control.id}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("reason")}
					/>
				)}
			</FormField>
			<DialogFooter>
				<DialogClose disabled={isSubmitting} render={<Button variant="outline" />}>
					{cs.common.cancel}
				</DialogClose>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
