const PLACEHOLDER = /\{(\w+)\}/g

type PluralForms = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string }

type NumberForms = Readonly<Partial<Record<string, string>>> & { readonly other: string }

// CAP-015-R28
export function fillText(
	template: string,
	values: Readonly<Record<string, string | number>>,
	language: string,
): string {
	return template.replace(PLACEHOLDER, (placeholder, name: string) => {
		const value = values[name]
		if (value === undefined) {
			return placeholder
		}
		return typeof value === "number" ? formatNumber(value, language) : value
	})
}

// CAP-015-R28
export function formatNumber(value: number, language: string): string {
	return new Intl.NumberFormat(language).format(value)
}

// CAP-015-R28
export function pluralText(forms: PluralForms, count: number, language: string): string {
	return forms[new Intl.PluralRules(language).select(count)] ?? forms.other
}

// CAP-015-R23, E120
export function numberText(forms: NumberForms, value: number | undefined): string {
	return (value === undefined ? undefined : forms[String(value)]) ?? forms.other
}

// CAP-015-R28
export function countText(forms: PluralForms, count: number, language: string): string {
	return fillText(pluralText(forms, count, language), { n: count }, language)
}
