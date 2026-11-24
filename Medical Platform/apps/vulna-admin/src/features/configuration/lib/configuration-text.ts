import type { ConfigurationField } from "@/features/configuration/constants/configuration-fields"
import cs from "@/i18n/cs.json"
import {
	ADMINISTRATION_LOCALE,
	BYTE_UNIT,
	DURATION_UNIT,
	type DurationUnit,
	formatList,
	UNIT_DISPLAY,
	unitName,
} from "@/lib/format"
import { amountOf, languageCodes } from "./configuration-form"

const texts = cs.configuration

const NO_AMOUNT = 0

interface FieldText {
	label: string
	hint?: string
}

const FIELD_TEXT: Readonly<Record<string, FieldText | undefined>> = texts.fields

const CHOICE_TEXT: Readonly<Record<string, Readonly<Record<string, string>> | undefined>> = texts.choices

const TRANSFER_SYNTAX_NAME: Readonly<Record<string, string | undefined>> = texts.transferSyntaxNames

const LANGUAGE_NAMES = new Intl.DisplayNames(ADMINISTRATION_LOCALE, { type: "language" })

export function fieldLabel(field: ConfigurationField): string {
	return FIELD_TEXT[field.key]?.label ?? field.key
}

export function fieldHint(field: ConfigurationField): string | undefined {
	return FIELD_TEXT[field.key]?.hint
}

export function choiceLabel(field: ConfigurationField, option: string): string {
	return CHOICE_TEXT[field.key]?.[option] ?? option
}

// integrace-dicom.md 3
export function transferSyntaxName(transferSyntax: string): string {
	return TRANSFER_SYNTAX_NAME[transferSyntax] ?? transferSyntax
}

// DESIGN.md 4.4
export function durationUnitName(unit: DurationUnit, amount: string): string {
	return unitName(unit, UNIT_DISPLAY.LONG, amountOf(amount) ?? NO_AMOUNT)
}

export function daysName(amount: string): string {
	return unitName(DURATION_UNIT.DAY, UNIT_DISPLAY.LONG, amountOf(amount) ?? NO_AMOUNT)
}

export function megabytesName(amount: string): string {
	return unitName(BYTE_UNIT.MEGABYTE, UNIT_DISPLAY.SHORT, amountOf(amount) ?? NO_AMOUNT)
}

export function languageName(code: string): string {
	try {
		return LANGUAGE_NAMES.of(code) ?? code
	} catch {
		return code
	}
}

export function languageNames(text: string): string | undefined {
	const codes = languageCodes(text)
	return codes.length === 0 ? undefined : formatList(codes.map(languageName))
}

export function tabText(id: string): string {
	const tabs: Readonly<Record<string, string>> = texts.tabs
	return tabs[id] ?? id
}

export function sectionText(id: string): { heading: string; description?: string } {
	const sections: Readonly<Record<string, { heading: string; description?: string }>> = texts.sections
	return sections[id] ?? { heading: id }
}
