import { localizedNameOf } from "@ansora/contracts"
import { defaultLanguage, type InstanceLanguages, interfaceLanguage, supportedLanguages } from "@ansora/core-mobile"
import Constants from "expo-constants"
import { getLocales } from "expo-localization"
import { useCallback } from "react"
import type { LocalizedNames } from "../api/code-lists"
import { sharedValue, useSharedValue } from "../utils/shared-value"
import { layeredTexts, RELEASE_LANGUAGES, type Texts } from "./texts"

interface Interface {
	language: string
	fallback: string
	selectable: readonly string[]
	texts: Texts
}

const releaseDefault = releaseDefaultLanguage()
let instance: InstanceLanguages | undefined
let signedInLanguage: string | null | undefined
const current = sharedValue(interfaceOf(undefined))

export function setInstanceLanguages(next: InstanceLanguages): void {
	instance = next
	refresh()
}

// CAP-015-R25
export function setSignedInLanguage(next: string | null | undefined): void {
	signedInLanguage = next
	refresh()
}

export function refreshDeviceLanguage(): void {
	refresh()
}

export function currentLanguage(): string {
	return current.get().language
}

export function currentTexts(): Texts {
	return current.get().texts
}

export function useTexts(): Texts {
	return useSharedValue(current).texts
}

export function useInterfaceLanguage(): string {
	return useSharedValue(current).language
}

// CAP-015-R24
export function useSelectableLanguages(): readonly string[] {
	return useSharedValue(current).selectable
}

export type LocalizedNameOf = (names: LocalizedNames) => string

// CAP-015-R26
export function useLocalizedName(): LocalizedNameOf {
	const { language, fallback } = useSharedValue(current)
	return useCallback((names: LocalizedNames) => localizedNameOf(names, language, fallback), [language, fallback])
}

function refresh(): void {
	current.set(interfaceOf(current.get()))
}

// CAP-015-R24, CAP-015-R26
function interfaceOf(previous: Interface | undefined): Interface {
	const situation = {
		releaseLanguages: RELEASE_LANGUAGES,
		releaseDefault,
		instance,
		deviceLanguages: getLocales(),
		signedInLanguage,
	}
	const language = interfaceLanguage(situation)
	const fallback = defaultLanguage(situation)
	const selectable = supportedLanguages(situation)
	if (
		previous !== undefined &&
		previous.language === language &&
		previous.fallback === fallback &&
		sameLanguages(previous.selectable, selectable)
	) {
		return previous
	}
	return { language, fallback, selectable, texts: layeredTexts(releaseDefault, [fallback, language]) }
}

function sameLanguages(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((language, index) => language === right[index])
}

function releaseDefaultLanguage(): string {
	const language = (Constants.expoConfig?.extra?.release as { defaultLanguage?: string } | undefined)?.defaultLanguage
	if (language === undefined || !RELEASE_LANGUAGES.includes(language)) {
		throw new Error(`the release default language ${language} has no language file`)
	}
	return language
}
