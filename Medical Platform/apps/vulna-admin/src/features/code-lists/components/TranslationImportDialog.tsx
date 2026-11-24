import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { TranslateIcon } from "@phosphor-icons/react"
import { type ChangeEvent, useState } from "react"
import { useForm } from "react-hook-form"
import { errorCodeOf, problemMemberOf } from "@/api/client"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { importTranslations } from "@/features/code-lists/hooks/use-code-lists"
import { fileLineOf, fileRowsOf, type ImportRows } from "@/features/code-lists/lib/translation-csv"
import {
	type TranslationImportValues,
	translationImportSchema,
} from "@/features/code-lists/lib/translation-import.schema"
import type { RejectedRow, TranslationImportResult } from "@/features/code-lists/types/code-list.types"
import cs from "@/i18n/cs.json"
import { CODE_LIST_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatCount } from "@/lib/format"

const texts = cs.codeLists.import

const LANGUAGE_FIELD_ID = "import-language"
const FILE_FIELD_ID = "import-file"
const REASON_FIELD_ID = "import-reason"
const CSV_TYPES = ".csv,text/csv,text/plain"

function isRejectedRow(value: unknown): value is RejectedRow {
	return (
		typeof value === "object" &&
		value !== null &&
		"row" in value &&
		typeof value.row === "number" &&
		"code" in value &&
		typeof value.code === "string" &&
		Object.hasOwn(texts.rejection, value.code)
	)
}

// administration.yaml Error.rejected_rows
function rejectedRowsOf(error: unknown): RejectedRow[] {
	if (errorCodeOf(error) !== ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_UNKNOWN) {
		return []
	}
	const member = problemMemberOf(error, "rejected_rows")
	return Array.isArray(member) ? member.filter(isRejectedRow) : []
}

function rowsHintOf(rows: ImportRows | undefined): string | undefined {
	if (rows?.ok !== true) {
		return undefined
	}
	const count = formatCount(rows.rows.length)
	if (rows.headerLineNumber === undefined) {
		return fillText(texts.rows, { count })
	}
	return fillText(texts.rowsWithHeader, { count, row: String(rows.headerLineNumber) })
}

// CAP-017-R18, CAP-017-S09
export function TranslationImportDialog({ codeListCodes }: { codeListCodes: readonly string[] | undefined }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<Button size="sm" variant="outline" disabled={codeListCodes === undefined} onClick={() => setOpen(true)}>
				<TranslateIcon aria-hidden />
				{texts.action}
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent closeLabel={cs.common.close}>
					<DialogHeader>
						<DialogTitle>{texts.heading}</DialogTitle>
						<DialogDescription>{texts.description}</DialogDescription>
					</DialogHeader>
					{codeListCodes === undefined ? null : <TranslationImportForm codeListCodes={codeListCodes} />}
				</DialogContent>
			</Dialog>
		</>
	)
}

function TranslationImportForm({ codeListCodes }: { codeListCodes: readonly string[] }) {
	const [rows, setRows] = useState<ImportRows | undefined>(undefined)
	const [fileError, setFileError] = useState<string | undefined>(undefined)
	const [failure, setFailure] = useState<unknown>(undefined)
	const [result, setResult] = useState<TranslationImportResult | undefined>(undefined)
	const form = useForm<TranslationImportValues>({
		resolver: zodResolver(translationImportSchema),
		defaultValues: { language: "", reason: "" },
	})
	const errors = form.formState.errors

	const read = async (event: ChangeEvent<HTMLInputElement>) => {
		setResult(undefined)
		setFailure(undefined)
		const file = event.target.files?.[0]
		if (file === undefined) {
			setRows(undefined)
			setFileError(undefined)
			return
		}
		const fileRows = fileRowsOf(await file.arrayBuffer(), codeListCodes)
		setRows(fileRows)
		setFileError(fileRows.ok ? undefined : fileRows.error)
	}

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		setResult(undefined)
		if (rows === undefined) {
			setFileError(texts.errors.fileRequired)
			return
		}
		if (!rows.ok) {
			setFileError(rows.error)
			return
		}
		try {
			setResult(await importTranslations({ language: values.language, reason: values.reason, items: rows.rows }))
		} catch (error) {
			setFailure(error)
		}
	})

	const rejected = rejectedRowsOf(failure)

	return (
		<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
			{result === undefined ? null : (
				<p role="status" className="text-sm">
					{fillText(texts.done, {
						updated: formatCount(result.updated_count),
						unchanged: formatCount(result.unchanged_count),
					})}
				</p>
			)}
			{failure === undefined ? null : (
				<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, CODE_LIST_MESSAGES)}</Notice>
			)}
			{rejected.length === 0 ? null : (
				<ul className="flex flex-col gap-1 text-sm">
					{rejected.map((row) => (
						<li key={row.row}>
							{fillText(texts.rejectedRow, {
								row: String(fileLineOf(rows, row.row)),
								reason: texts.rejection[row.code],
							})}
						</li>
					))}
				</ul>
			)}
			<FormField
				id={LANGUAGE_FIELD_ID}
				label={texts.language}
				hint={texts.languageHint}
				error={errors.language?.message}
			>
				{(control) => (
					<Input
						id={control.id}
						className="identifier max-w-32"
						autoComplete="off"
						spellCheck={false}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						{...form.register("language")}
					/>
				)}
			</FormField>
			<FormField id={FILE_FIELD_ID} label={texts.file} hint={rowsHintOf(rows)} error={fileError}>
				{(control) => (
					<Input
						id={control.id}
						type="file"
						accept={CSV_TYPES}
						aria-invalid={control.invalid}
						aria-describedby={control.describedBy}
						onChange={(event) => void read(event)}
					/>
				)}
			</FormField>
			<FormField id={REASON_FIELD_ID} label={texts.reason} error={errors.reason?.message}>
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
				<DialogClose render={<Button variant="outline" />}>{cs.common.close}</DialogClose>
				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting ? texts.submitting : texts.submit}
				</Button>
			</DialogFooter>
		</form>
	)
}
