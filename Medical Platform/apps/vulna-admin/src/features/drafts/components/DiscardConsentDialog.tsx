import { DRAFT_DISCARD_REASONS } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
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
import { NativeSelect } from "@/components/ui/native-select"
import { discardDraftsWithConsent } from "@/features/drafts/hooks/use-drafts"
import { type DraftDiscardValues, draftDiscardSchema } from "@/features/drafts/lib/draft-discard.schema"
import type { AdministeredDraft, DraftDiscardResult } from "@/features/drafts/types/draft.types"
import cs from "@/i18n/cs.json"
import { DRAFT_DISCARD_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount, formatDateTime } from "@/lib/format"

const texts = cs.drafts.consent

const REASON_FIELD_ID = "draft-discard-reason"
const NO_REASON = ""

interface Props {
	open: boolean
	operatorName: string
	drafts: readonly AdministeredDraft[]
	onOpenChange: (open: boolean) => void
	onDiscarded: (result: DraftDiscardResult) => void
}

// CAP-015-R19, CAP-015-R20, CAP-015-S18, stavy-a-mikrocopy.md E77
export function DiscardConsentDialog({ open, operatorName, drafts, onOpenChange, onDiscarded }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent closeLabel={cs.common.close}>
				<DialogHeader>
					<DialogTitle>{fillText(texts.heading, { name: operatorName })}</DialogTitle>
					<DialogDescription>
						{fillText(texts.body, { count: formatCount(drafts.length), time: oldestChangeOf(drafts) })}
					</DialogDescription>
				</DialogHeader>
				<DiscardConsentForm drafts={drafts} onDiscarded={onDiscarded} />
			</DialogContent>
		</Dialog>
	)
}

function DiscardConsentForm({
	drafts,
	onDiscarded,
}: {
	drafts: readonly AdministeredDraft[]
	onDiscarded: (result: DraftDiscardResult) => void
}) {
	const [failure, setFailure] = useState<unknown>(undefined)
	const form = useForm<DraftDiscardValues>({
		resolver: zodResolver(draftDiscardSchema),
		defaultValues: { reason: NO_REASON as DraftDiscardValues["reason"] },
	})
	const reasonError = form.formState.errors.reason?.message

	const submit = form.handleSubmit(async (values) => {
		const operatorUserId = drafts[0]?.operator_user_id
		if (operatorUserId === undefined) {
			return
		}
		setFailure(undefined)
		try {
			onDiscarded(
				await discardDraftsWithConsent({
					operator_user_id: operatorUserId,
					reason: values.reason,
					acquisitions: drafts.map((draft) => ({
						acquisition_id: draft.acquisition_id,
						seen_updated_at: draft.updated_at,
					})),
				}),
			)
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, DRAFT_DISCARD_MESSAGES)}</Notice>
			)}
			<FormField id={REASON_FIELD_ID} label={texts.reason} error={reasonError}>
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
						{DRAFT_DISCARD_REASONS.map((reason) => (
							<option key={reason} value={reason}>
								{texts.reasonValue[reason]}
							</option>
						))}
					</NativeSelect>
				)}
			</FormField>
			<DialogFooter>
				<DialogClose render={<Button variant="outline" />}>{cs.common.cancel}</DialogClose>
				<Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}

function oldestChangeOf(drafts: readonly AdministeredDraft[]): string {
	const oldest = drafts.reduce<string | undefined>(
		(earliest, draft) => (earliest === undefined || draft.updated_at < earliest ? draft.updated_at : earliest),
		undefined,
	)
	return oldest === undefined ? cs.common.notStated : formatDateTime(oldest)
}
