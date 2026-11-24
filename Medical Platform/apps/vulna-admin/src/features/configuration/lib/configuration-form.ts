import {
	APP_VERSION_PATTERN,
	CONFIGURATION_KEY,
	DICOM_AE_TITLE_PATTERN,
	DICOM_UID_PATTERN,
	HOST_NAME_PATTERN,
	hasCapturingGroup,
	isSecureWebAddress,
	isWebAddress,
	LANGUAGE_CODE_PATTERN,
	PACS_CONNECTION_KEYS,
	type Role,
} from "@ansora/contracts"
import {
	CONFIGURATION_SECTIONS,
	type ConfigurationField,
	type ConfigurationSection,
	FIELD_KIND,
	TEXT_FORMAT,
	type TextFormat,
} from "@/features/configuration/constants/configuration-fields"
import type { ConfigurationItem } from "@/features/configuration/types/configuration.types"
import cs from "@/i18n/cs.json"
import {
	BYTE_UNIT,
	BYTES_IN,
	DURATION_UNIT,
	type DurationUnit,
	fillText,
	formatBytes,
	formatCount,
	formatDays,
	formatDuration,
	SECONDS_IN,
} from "@/lib/format"

const errors = cs.configuration.errors

export interface RoleRow {
	group: string
	role: Role | ""
}

interface DurationEdit {
	amount: string
	unit: DurationUnit
}

export interface TransferSyntaxRow {
	transferSyntax: string
	isChosen: boolean
}

export interface TransferSyntaxesEdit {
	rows: readonly TransferSyntaxRow[]
}

export type EditValue = boolean | string | DurationEdit | TransferSyntaxesEdit | readonly RoleRow[]

export type EditValues = Readonly<Record<string, EditValue>>

type Parsed = { ok: true; value: unknown } | { ok: false; error: string }

const BYTES_IN_MEGABYTE = BYTES_IN[BYTE_UNIT.MEGABYTE]
const LANGUAGE_SEPARATOR = /[\s,]+/
const LANGUAGE_JOINER = ", "
const WHOLE_NUMBER = /^\d+$/
const DECIMAL_NUMBER = /^\d+([.,]\d+)?$/
const DECIMAL_COMMA = ","
const DECIMAL_POINT = "."
const NO_WHITESPACE = /^\S+$/
const AMOUNT_FRACTION_DIGITS = 2
export const NOT_CHOSEN = ""

const TEXT_CHECK: Readonly<Record<TextFormat, (text: string) => boolean>> = {
	[TEXT_FORMAT.IDENTIFIER]: (text) => NO_WHITESPACE.test(text),
	[TEXT_FORMAT.APP_VERSION]: (text) => APP_VERSION_PATTERN.test(text),
	[TEXT_FORMAT.HOST]: (text) => HOST_NAME_PATTERN.test(text),
	[TEXT_FORMAT.CAPTURING_PATTERN]: hasCapturingGroup,
	[TEXT_FORMAT.URL]: isWebAddress,
	[TEXT_FORMAT.SECURE_URL]: isSecureWebAddress,
	[TEXT_FORMAT.DICOM_UID]: (text) => DICOM_UID_PATTERN.test(text),
	[TEXT_FORMAT.AE_TITLE]: (text) => DICOM_AE_TITLE_PATTERN.test(text),
}

const TEXT_FORMAT_ERROR: Readonly<Record<TextFormat, string>> = {
	[TEXT_FORMAT.IDENTIFIER]: errors.whitespace,
	[TEXT_FORMAT.APP_VERSION]: errors.appVersion,
	[TEXT_FORMAT.HOST]: errors.host,
	[TEXT_FORMAT.CAPTURING_PATTERN]: errors.capturingPattern,
	[TEXT_FORMAT.URL]: errors.url,
	[TEXT_FORMAT.SECURE_URL]: errors.secureUrl,
	[TEXT_FORMAT.DICOM_UID]: errors.dicomUid,
	[TEXT_FORMAT.AE_TITLE]: errors.aeTitle,
}

export function isRoleRows(edit: EditValue): edit is readonly RoleRow[] {
	return Array.isArray(edit)
}

export function isDurationEdit(edit: EditValue): edit is DurationEdit {
	return typeof edit === "object" && !Array.isArray(edit) && "amount" in edit
}

export function isTransferSyntaxesEdit(edit: EditValue): edit is TransferSyntaxesEdit {
	return typeof edit === "object" && !Array.isArray(edit) && "rows" in edit
}

function isRoleRow(value: unknown): value is RoleRow {
	return typeof value === "object" && value !== null && "group" in value && "role" in value
}

function amountText(value: number): string {
	return String(Number(value.toFixed(AMOUNT_FRACTION_DIGITS))).replace(DECIMAL_POINT, DECIMAL_COMMA)
}

export function amountOf(text: string): number | undefined {
	const trimmed = text.trim()
	return DECIMAL_NUMBER.test(trimmed) ? Number(trimmed.replace(DECIMAL_COMMA, DECIMAL_POINT)) : undefined
}

// DESIGN.md 4.4
function durationEditOf(seconds: unknown, units: readonly DurationUnit[]): DurationEdit {
	const smallest = units[0] ?? DURATION_UNIT.MINUTE
	if (typeof seconds !== "number") {
		return { amount: "", unit: smallest }
	}
	const whole = [...units].reverse().find((unit) => seconds % SECONDS_IN[unit] === 0) ?? smallest
	return { amount: amountText(seconds / SECONDS_IN[whole]), unit: whole }
}

function stringsOf(values: readonly unknown[]): string[] {
	return values.filter((value): value is string => typeof value === "string")
}

// CAP-021-R17, integrace-dicom.md 3
function transferSyntaxesEditOf(value: unknown, allowed: readonly unknown[]): TransferSyntaxesEdit {
	const chosen = Array.isArray(value) ? stringsOf(value) : []
	const offered = stringsOf(allowed).filter((transferSyntax) => !chosen.includes(transferSyntax))
	return {
		rows: [
			...chosen.map((transferSyntax) => ({ transferSyntax, isChosen: true })),
			...offered.map((transferSyntax) => ({ transferSyntax, isChosen: false })),
		],
	}
}

export function languageCodes(text: string): string[] {
	return text.split(LANGUAGE_SEPARATOR).filter((code) => code !== "")
}

export function isShown(field: ConfigurationField, edits: EditValues): boolean {
	if (field.shownWhen === undefined) {
		return true
	}
	return String(edits[field.shownWhen.key]) === field.shownWhen.value
}

export function sectionsFor(items: readonly ConfigurationItem[]): ConfigurationSection[] {
	const present = new Set(items.map((item) => item.key))
	return CONFIGURATION_SECTIONS.map((section) => ({
		...section,
		fields: section.fields.filter((field) => present.has(field.key)),
	})).filter((section) => section.fields.length > 0)
}

function editValueOf(field: ConfigurationField, item: ConfigurationItem | undefined): EditValue {
	const value = item?.value
	switch (field.kind) {
		case FIELD_KIND.SWITCH:
			return value === true
		case FIELD_KIND.COUNT:
		case FIELD_KIND.DAYS:
			return typeof value === "number" ? String(value) : ""
		case FIELD_KIND.MEGABYTES:
			return typeof value === "number" ? amountText(value / BYTES_IN_MEGABYTE) : ""
		case FIELD_KIND.DURATION:
			return durationEditOf(value, field.units)
		case FIELD_KIND.LANGUAGES:
			return Array.isArray(value) ? value.join(LANGUAGE_JOINER) : ""
		case FIELD_KIND.ROLE_MAPPING:
			return Array.isArray(value) ? value.filter(isRoleRow).map((row) => ({ group: row.group, role: row.role })) : []
		case FIELD_KIND.TRANSFER_SYNTAXES:
			return transferSyntaxesEditOf(value, item?.allowed_values ?? [])
		default:
			return typeof value === "string" ? value : ""
	}
}

export function editValuesOf(
	sections: readonly ConfigurationSection[],
	items: readonly ConfigurationItem[],
): EditValues {
	const itemsByKey = new Map(items.map((item) => [item.key, item]))
	const edits: Record<string, EditValue> = {}
	for (const field of sections.flatMap((section) => section.fields)) {
		edits[field.key] = editValueOf(field, itemsByKey.get(field.key))
	}
	return edits
}

function withinLimits(value: number, item: ConfigurationItem, format: (limit: number) => string): Parsed {
	if (typeof item.lower_limit === "number" && value < item.lower_limit) {
		return { ok: false, error: fillText(errors.below, { min: format(item.lower_limit) }) }
	}
	if (typeof item.upper_limit === "number" && value > item.upper_limit) {
		return { ok: false, error: fillText(errors.above, { max: format(item.upper_limit) }) }
	}
	return { ok: true, value }
}

function parseWhole(
	text: string,
	item: ConfigurationItem,
	format: (limit: number) => string,
	optional: boolean,
): Parsed {
	const trimmed = text.trim()
	if (trimmed === "") {
		return optional ? { ok: true, value: null } : { ok: false, error: errors.required }
	}
	if (!WHOLE_NUMBER.test(trimmed)) {
		return { ok: false, error: errors.wholeNumber }
	}
	return withinLimits(Number(trimmed), item, format)
}

function parseMegabytes(text: string, item: ConfigurationItem): Parsed {
	if (text.trim() === "") {
		return { ok: false, error: errors.required }
	}
	const amount = amountOf(text)
	if (amount === undefined) {
		return { ok: false, error: errors.number }
	}
	return withinLimits(Math.round(amount * BYTES_IN_MEGABYTE), item, formatBytes)
}

function parseDuration(edit: DurationEdit, optional: boolean, item: ConfigurationItem): Parsed {
	if (edit.amount.trim() === "") {
		return optional ? { ok: true, value: null } : { ok: false, error: errors.required }
	}
	const amount = amountOf(edit.amount)
	if (amount === undefined) {
		return { ok: false, error: errors.number }
	}
	return withinLimits(Math.round(amount * SECONDS_IN[edit.unit]), item, formatDuration)
}

function parseText(text: string, format: TextFormat, optional: boolean): Parsed {
	const trimmed = text.trim()
	if (trimmed === "") {
		return optional ? { ok: true, value: null } : { ok: false, error: errors.required }
	}
	return TEXT_CHECK[format](trimmed) ? { ok: true, value: trimmed } : { ok: false, error: TEXT_FORMAT_ERROR[format] }
}

function parseChoice(choice: string, options: readonly string[], optional: boolean): Parsed {
	if (choice === NOT_CHOSEN && optional) {
		return { ok: true, value: null }
	}
	return options.includes(choice) ? { ok: true, value: choice } : { ok: false, error: errors.required }
}

function parseLanguages(text: string): Parsed {
	const codes = languageCodes(text)
	if (codes.length === 0) {
		return { ok: false, error: errors.required }
	}
	if (codes.some((code) => !LANGUAGE_CODE_PATTERN.test(code))) {
		return { ok: false, error: errors.language }
	}
	if (new Set(codes).size !== codes.length) {
		return { ok: false, error: errors.duplicate }
	}
	return { ok: true, value: codes }
}

// CAP-021-R17, integrace-dicom.md 3
function parseTransferSyntaxes(edit: TransferSyntaxesEdit): Parsed {
	const chosen = edit.rows.filter((row) => row.isChosen).map((row) => row.transferSyntax)
	return chosen.length === 0 ? { ok: false, error: errors.transferSyntaxRequired } : { ok: true, value: chosen }
}

function parseRoleMapping(rows: readonly RoleRow[]): Parsed {
	const mapping = rows.map((row) => ({ group: row.group.trim(), role: row.role }))
	if (mapping.some((row) => !NO_WHITESPACE.test(row.group))) {
		return { ok: false, error: errors.roleGroup }
	}
	if (mapping.some((row) => row.role === "")) {
		return { ok: false, error: errors.role }
	}
	if (new Set(mapping.map((row) => JSON.stringify(row))).size !== mapping.length) {
		return { ok: false, error: errors.duplicate }
	}
	return { ok: true, value: mapping }
}

function parse(field: ConfigurationField, edit: EditValue, item: ConfigurationItem): Parsed {
	switch (field.kind) {
		case FIELD_KIND.SWITCH:
			return { ok: true, value: edit === true }
		case FIELD_KIND.COUNT:
			return parseWhole(String(edit), item, formatCount, field.optional)
		case FIELD_KIND.DAYS:
			return parseWhole(String(edit), item, formatDays, field.optional)
		case FIELD_KIND.MEGABYTES:
			return parseMegabytes(String(edit), item)
		case FIELD_KIND.DURATION:
			return isDurationEdit(edit) ? parseDuration(edit, field.optional, item) : { ok: false, error: errors.required }
		case FIELD_KIND.TEXT:
			return parseText(String(edit), field.format, field.optional)
		case FIELD_KIND.CHOICE:
			return parseChoice(String(edit), field.options, field.optional)
		case FIELD_KIND.DEFAULT_LANGUAGE:
			return LANGUAGE_CODE_PATTERN.test(String(edit))
				? { ok: true, value: edit }
				: { ok: false, error: errors.required }
		case FIELD_KIND.LANGUAGES:
			return parseLanguages(String(edit))
		case FIELD_KIND.ROLE_MAPPING:
			return parseRoleMapping(isRoleRows(edit) ? edit : [])
		case FIELD_KIND.TRANSFER_SYNTAXES:
			return isTransferSyntaxesEdit(edit)
				? parseTransferSyntaxes(edit)
				: { ok: false, error: errors.transferSyntaxRequired }
	}
}

function withSortedKeys(_key: string, value: unknown): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return value
	}
	return Object.fromEntries(Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1)))
}

function isSameValue(left: unknown, right: unknown): boolean {
	return JSON.stringify(left, withSortedKeys) === JSON.stringify(right, withSortedKeys)
}

interface FormState {
	changes: { key: string; value: unknown }[]
	errors: Readonly<Record<string, string>>
}

// CAP-012-R28
function defaultLanguageError(edits: EditValues): string | undefined {
	const supported = languageCodes(String(edits[CONFIGURATION_KEY.SUPPORTED_LANGUAGES] ?? ""))
	const chosen = edits[CONFIGURATION_KEY.DEFAULT_LANGUAGE]
	return chosen === undefined || supported.includes(String(chosen)) ? undefined : cs.errors.defaultLanguageNotSupported
}

// CAP-012-R01, CAP-012-S01
function pacsConnectionErrors(edits: EditValues): Record<string, string> {
	if (PACS_CONNECTION_KEYS.some((key) => edits[key] === undefined)) {
		return {}
	}
	const isFilled = (key: string) => String(edits[key]).trim() !== ""
	const missing = PACS_CONNECTION_KEYS.filter((key) => !isFilled(key))
	if (missing.length === 0 || missing.length === PACS_CONNECTION_KEYS.length) {
		return {}
	}
	return Object.fromEntries(missing.map((key) => [key, errors.pacsConnection]))
}

// CAP-012-R19
export function formStateOf(
	sections: readonly ConfigurationSection[],
	items: readonly ConfigurationItem[],
	edits: EditValues,
): FormState {
	const itemsByKey = new Map(items.map((item) => [item.key, item]))
	const changes: FormState["changes"] = []
	const fieldErrors: Record<string, string> = {}
	for (const field of sections.flatMap((section) => section.fields)) {
		const item = itemsByKey.get(field.key)
		const edit = edits[field.key]
		if (item === undefined || edit === undefined || !isShown(field, edits)) {
			continue
		}
		const parsed = parse(field, edit, item)
		if (!parsed.ok) {
			fieldErrors[field.key] = parsed.error
			continue
		}
		if (!isSameValue(parsed.value, item.value)) {
			changes.push({ key: field.key, value: parsed.value })
		}
	}
	const languageError = defaultLanguageError(edits)
	if (languageError !== undefined && fieldErrors[CONFIGURATION_KEY.DEFAULT_LANGUAGE] === undefined) {
		fieldErrors[CONFIGURATION_KEY.DEFAULT_LANGUAGE] = languageError
	}
	return { changes, errors: { ...pacsConnectionErrors(edits), ...fieldErrors } }
}
