import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { FormField } from "@/components/custom/form-field"
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
import {
	type ConfigurationReasonValues,
	configurationReasonSchema,
} from "@/features/configuration/lib/configuration-reason.schema"
import { QuickLoginWarning } from "@/features/login-methods/components/QuickLoginWarning"
import cs from "@/i18n/cs.json"
import { fillText, formatCount } from "@/lib/format"

const texts = cs.configuration.reason

const REASON_FIELD_ID = "configuration-reason"

interface Props {
	open: boolean
	changeCount: number
	onlyAccountLogin: boolean
	onOpenChange: (open: boolean) => void
	onSubmit: (reason: string) => Promise<void>
}

// CAP-012-R19, CAP-012-R26
export function ReasonDialog({ open, changeCount, onlyAccountLogin, onOpenChange, onSubmit }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent closeLabel={cs.common.close} className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{texts.heading}</DialogTitle>
					<DialogDescription>{texts.description}</DialogDescription>
				</DialogHeader>
				<ReasonForm changeCount={changeCount} onlyAccountLogin={onlyAccountLogin} onSubmit={onSubmit} />
			</DialogContent>
		</Dialog>
	)
}

function ReasonForm({ changeCount, onlyAccountLogin, onSubmit }: Omit<Props, "open" | "onOpenChange">) {
	const form = useForm<ConfigurationReasonValues>({
		resolver: zodResolver(configurationReasonSchema),
		defaultValues: { reason: "" },
	})
	const submit = form.handleSubmit((values) => onSubmit(values.reason))

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			<p className="text-sm">{fillText(texts.changes, { count: formatCount(changeCount) })}</p>
			{onlyAccountLogin ? <QuickLoginWarning /> : null}
			<FormField id={REASON_FIELD_ID} label={texts.label} error={form.formState.errors.reason?.message}>
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
				<DialogClose render={<Button variant="outline" />}>{cs.common.cancel}</DialogClose>
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? cs.common.saving : cs.common.save}
				</Button>
			</DialogFooter>
		</form>
	)
}
