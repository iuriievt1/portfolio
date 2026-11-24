import { en } from './en'

type TranslationKey = keyof typeof en

export function t(key: TranslationKey, params?: Record<string, string>): string {
	let value: string = en[key]
	if (params) {
		for (const [k, v] of Object.entries(params)) {
			value = value.replace(`{${k}}`, v)
		}
	}
	return value
}

export type { TranslationKey }
