import { CODE_LIST_ITEM_CODE_MAX_LENGTH, CODE_LIST_ITEM_NAME_MAX_LENGTH, isSameLanguage } from "@ansora/contracts"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react"
import { useId, useMemo, useState } from "react"
import { flushSync } from "react-dom"
import { Controller, type FieldErrors, type UseFormReturn, useFieldArray, useForm, useWatch } from "react-hook-form"
import { useParams } from "react-router"
import { describedByOf, FieldMessages } from "@/components/custom/form-field"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection, PageSections } from "@/components/custom/page-section"
import { SaveStatus } from "@/components/custom/save-status"
import { TableScroll } from "@/components/custom/table-scroll"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { saveCodeListItems, useCodeListItems, useCodeLists } from "@/features/code-lists/hooks/use-code-lists"
import {
	defaultLanguageOf,
	editableItemsOf,
	editedLanguagesOf,
	newItem,
	otherLanguagesOf,
	requestOf,
} from "@/features/code-lists/lib/code-list-editor"
import { type CodeListItemsValues, codeListItemsSchema } from "@/features/code-lists/lib/code-list-items.schema"
import type { CodeListItem } from "@/features/code-lists/types/code-list.types"
import { useConfiguration } from "@/features/configuration/hooks/use-configuration"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { UnsavedChangesPrompt } from "@/layouts/unsaved-changes-prompt"
import { CODE_LIST_MESSAGES, errorMessageOf } from "@/lib/error-message"
import { fillText, formatList } from "@/lib/format"
import { requestFailure } from "@/lib/request-failure"
import { ROUTES } from "@/lib/routes"
import { savedAtText } from "@/lib/saved-at"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard"

const texts = cs.codeLists

const LIST_CRUMB = { to: `/${ROUTES.CODE_LISTS}`, label: texts.heading }

// CAP-017-R18
const EDITED_LANGUAGES = ["cs", "en"] as const
const MOVE_UP = -1
const MOVE_DOWN = 1

// CAP-017-R05, CAP-017-R08, CAP-017-R13, CAP-017-R18
export function CodeListPage() {
	const { codeListCode = "" } = useParams()
	const items = useCodeListItems(codeListCode)
	const codeLists = useCodeLists()
	const configuration = useConfiguration()
	const name = codeLists.data?.find((codeList) => codeList.code === codeListCode)?.name
	useShellTitle(name ?? texts.heading, LIST_CRUMB)

	const defaultLanguage = configuration.data === undefined ? undefined : defaultLanguageOf(configuration.data)
	if (items.data === undefined || defaultLanguage === undefined) {
		const isLanguageMissing = configuration.data !== undefined && defaultLanguage === undefined
		return (
			<PagePending
				failure={isLanguageMissing ? cs.errors.generic : requestFailure(items.error ?? configuration.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={() => {
					items.reload()
					configuration.reload()
				}}
			/>
		)
	}
	return (
		<CodeListEditor
			key={codeListCode}
			codeListCode={codeListCode}
			items={items.data}
			defaultLanguage={defaultLanguage}
			onSaved={codeLists.reload}
		/>
	)
}

interface EditorProps {
	codeListCode: string
	items: CodeListItem[]
	defaultLanguage: string
	onSaved: () => void
}

function CodeListEditor({ codeListCode, items, defaultLanguage, onSaved }: EditorProps) {
	const languages = useMemo(() => editedLanguagesOf(defaultLanguage, EDITED_LANGUAGES), [defaultLanguage])
	const [failure, setFailure] = useState<unknown>(undefined)
	const [savedAt, setSavedAt] = useState<string | undefined>(undefined)
	const form = useForm<CodeListItemsValues>({
		resolver: zodResolver(codeListItemsSchema(defaultLanguage)),
		defaultValues: { items: editableItemsOf(items, languages) },
	})
	const rows = useFieldArray({ control: form.control, name: "items" })
	const dirty = form.formState.isDirty
	const blocker = useUnsavedChangesGuard(dirty)
	const errors = form.formState.errors.items
	const invalid = form.formState.isSubmitted && !form.formState.isValid

	const submit = form.handleSubmit(async (values) => {
		setFailure(undefined)
		try {
			const saved = await saveCodeListItems(codeListCode, requestOf(values.items, defaultLanguage, languages))
			form.reset({ items: editableItemsOf(saved, languages) })
			setSavedAt(new Date().toISOString())
			onSaved()
		} catch (error) {
			setFailure(error)
		}
	})

	const move = (index: number, offset: number, button: HTMLElement) => {
		flushSync(() => rows.move(index, index + offset))
		button.focus()
	}

	return (
		<PageSections>
			<PageSection
				title={texts.items.heading}
				description={texts.items.description}
				action={
					<Button size="sm" variant="outline" onClick={() => rows.append(newItem(languages))}>
						<PlusIcon aria-hidden />
						{texts.items.add}
					</Button>
				}
				flush
			>
				<form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
					{failure === undefined ? null : (
						<div className="px-(--card-p)">
							<Notice tone={NOTICE_TONE.CRITICAL}>{errorMessageOf(failure, CODE_LIST_MESSAGES)}</Notice>
						</div>
					)}
					{invalid ? (
						<div className="px-(--card-p)">
							<Notice tone={NOTICE_TONE.CRITICAL}>{cs.common.invalid}</Notice>
						</div>
					) : null}
					{rows.fields.length === 0 ? (
						<p className="px-(--card-p) text-sm text-muted-foreground">{texts.items.empty}</p>
					) : (
						<TableScroll label={texts.items.tableLabel}>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{texts.columns.code}</TableHead>
										{languages.map((language) => (
											<TableHead key={language}>
												{isSameLanguage(language, defaultLanguage)
													? fillText(texts.items.defaultName, { language })
													: fillText(texts.items.languageName, { language })}
											</TableHead>
										))}
										<TableHead>{texts.items.offered}</TableHead>
										<TableHead>
											<span className="sr-only">{texts.items.order}</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.fields.map((field, index) => (
										<ItemRow
											key={field.id}
											index={index}
											form={form}
											languages={languages}
											errors={errors}
											isFirst={index === 0}
											isLast={index === rows.fields.length - 1}
											onMove={(offset, button) => move(index, offset, button)}
											onRemove={() => rows.remove(index)}
										/>
									))}
								</TableBody>
							</Table>
						</TableScroll>
					)}
					<div className="flex flex-wrap items-center gap-3 px-(--card-p) pb-(--card-p)">
						<Button type="submit" disabled={!dirty || form.formState.isSubmitting}>
							{form.formState.isSubmitting ? cs.common.saving : cs.common.save}
						</Button>
						<SaveStatus message={dirty ? undefined : savedAtText(savedAt)} />
					</div>
				</form>
			</PageSection>
			<UnsavedChangesPrompt blocker={blocker} />
		</PageSections>
	)
}

interface ItemRowProps {
	index: number
	form: UseFormReturn<CodeListItemsValues>
	languages: readonly string[]
	errors: FieldErrors<CodeListItemsValues>["items"]
	isFirst: boolean
	isLast: boolean
	onMove: (offset: number, button: HTMLElement) => void
	onRemove: () => void
}

function ItemRow({ index, form, languages, errors, isFirst, isLast, onMove, onRemove }: ItemRowProps) {
	const item = useWatch({ control: form.control, name: `items.${index}` })
	const rowId = useId()
	const rowErrors = errors?.[index]
	const codeId = `${rowId}-code`
	const codeError = rowErrors?.code?.message
	const others = otherLanguagesOf(item, languages)
	const itemLabel = item.isNew ? fillText(texts.items.newItem, { row: String(index + 1) }) : item.code

	return (
		<TableRow>
			<TableCell className="min-w-48 align-top whitespace-normal">
				{item.isNew ? (
					<div className="flex flex-col gap-1">
						<Input
							id={codeId}
							className="identifier"
							autoComplete="off"
							spellCheck={false}
							maxLength={CODE_LIST_ITEM_CODE_MAX_LENGTH}
							aria-label={fillText(texts.items.codeLabel, { item: itemLabel })}
							aria-invalid={codeError !== undefined}
							aria-describedby={describedByOf(codeId, texts.items.codeHint, codeError)}
							{...form.register(`items.${index}.code`)}
						/>
						<FieldMessages id={codeId} hint={texts.items.codeHint} error={codeError} />
					</div>
				) : (
					<div className="flex flex-col gap-1">
						<span className="identifier wrap-break-word">{item.code}</span>
						{item.isActive ? null : <span className="text-xs text-muted-foreground">{texts.items.withdrawn}</span>}
						{others.length === 0 ? null : (
							<span className="text-xs text-muted-foreground">
								{fillText(texts.items.otherLanguages, { languages: formatList(others) })}
							</span>
						)}
					</div>
				)}
			</TableCell>
			{languages.map((language) => {
				const nameId = `${rowId}-name-${language}`
				const error = rowErrors?.names?.[language]?.message
				return (
					<TableCell key={language} className="min-w-48 align-top whitespace-normal">
						<div className="flex flex-col gap-1">
							<Input
								id={nameId}
								autoComplete="off"
								maxLength={CODE_LIST_ITEM_NAME_MAX_LENGTH}
								aria-label={fillText(texts.items.nameLabel, { language, item: itemLabel })}
								aria-invalid={error !== undefined}
								aria-describedby={describedByOf(nameId, undefined, error)}
								{...form.register(`items.${index}.names.${language}`)}
							/>
							<FieldMessages id={nameId} error={error} />
						</div>
					</TableCell>
				)
			})}
			<TableCell className="align-top">
				<Controller
					control={form.control}
					name={`items.${index}.isActive`}
					render={({ field }) => (
						<Switch
							checked={field.value}
							aria-label={fillText(texts.items.offeredLabel, { item: itemLabel })}
							onCheckedChange={(checked) => field.onChange(checked)}
							onBlur={field.onBlur}
						/>
					)}
				/>
			</TableCell>
			<TableCell className="align-top">
				<div className="flex items-center gap-1">
					<Button
						size="icon-sm"
						variant="ghost"
						className="aria-disabled:opacity-50"
						aria-label={fillText(cs.common.moveUp, { item: itemLabel })}
						disabled={isFirst}
						focusableWhenDisabled
						onClick={(event) => onMove(MOVE_UP, event.currentTarget)}
					>
						<ArrowUpIcon aria-hidden />
					</Button>
					<Button
						size="icon-sm"
						variant="ghost"
						className="aria-disabled:opacity-50"
						aria-label={fillText(cs.common.moveDown, { item: itemLabel })}
						disabled={isLast}
						focusableWhenDisabled
						onClick={(event) => onMove(MOVE_DOWN, event.currentTarget)}
					>
						<ArrowDownIcon aria-hidden />
					</Button>
					{item.isNew ? (
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label={fillText(texts.items.remove, { item: itemLabel })}
							onClick={onRemove}
						>
							<TrashIcon aria-hidden />
						</Button>
					) : null}
				</div>
			</TableCell>
		</TableRow>
	)
}
