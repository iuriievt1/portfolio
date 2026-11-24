import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { deleteOrphanedObject } from "@/features/orphaned-objects/hooks/use-orphaned-objects"
import {
	type OrphanedObjectDeletionValues,
	orphanedObjectDeletionSchema,
} from "@/features/orphaned-objects/lib/orphaned-object-deletion.schema"
import { shortObjectIdOf } from "@/features/orphaned-objects/lib/orphaned-object-view"
import cs from "@/i18n/cs.json"
import { errorMessageOf, ORPHANED_OBJECT_DELETION_MESSAGES } from "@/lib/error-message"
import { fillText } from "@/lib/format"

const texts = cs.orphanedObjects.deleteDialog

const REASON_FIELD_ID = "orphaned-object-deletion-reason"

interface Props {
	objectId: string
	onDeleted: (objectId: string) => void
}

// CAP-026-S08, stavy-a-mikrocopy.md E67, DESIGN.md 9.5
export function OrphanedObjectDeletionAction({ objectId, onDeleted }: Props) {
	const [open, setOpen] = useState(false)
	const [failure, setFailure] = useState<unknown>(undefined)
	const deleted = useRef(false)
	const shortId = shortObjectIdOf(objectId)
	const form = useForm<OrphanedObjectDeletionValues>({
		resolver: zodResolver(orphanedObjectDeletionSchema),
		defaultValues: { reason: "" },
	})
	const reasonError = form.formState.errors.reason?.message
	const isDeleting = form.formState.isSubmitting

	const openDialog = () => {
		setFailure(undefined)
		form.reset()
		setOpen(true)
	}

	const changeOpen = (next: boolean) => {
		if (!isDeleting) {
			setOpen(next)
		}
	}

	const reloadAfterClose = (opened: boolean) => {
		if (opened || !deleted.current) {
			return
		}
		deleted.current = false
		onDeleted(objectId)
	}

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			await deleteOrphanedObject(objectId, values)
			deleted.current = true
			setOpen(false)
		} catch (error) {
			setFailure(error)
		}
	})

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				aria-label={fillText(texts.triggerLabel, { id: shortId })}
				onClick={openDialog}
			>
				{texts.trigger}
			</Button>
			<Dialog open={open} onOpenChange={changeOpen} onOpenChangeComplete={reloadAfterClose}>
				<DialogContent closeLabel={cs.common.close} className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{texts.heading}</DialogTitle>
						<DialogDescription>{fillText(texts.body, { id: shortId })}</DialogDescription>
					</DialogHeader>
					<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
						{failure === undefined ? null : (
							<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, ORPHANED_OBJECT_DELETION_MESSAGES)}</Notice>
						)}
						<FormField id={REASON_FIELD_ID} label={texts.reason} error={reasonError}>
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
							<Button type="button" variant="outline" disabled={isDeleting} onClick={() => setOpen(false)}>
								{cs.common.cancel}
							</Button>
							<Button type="submit" variant="destructive" disabled={isDeleting}>
								{isDeleting ? texts.submitting : texts.submit}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	)
}
