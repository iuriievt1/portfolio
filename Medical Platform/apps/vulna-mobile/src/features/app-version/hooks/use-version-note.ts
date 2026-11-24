import { appVersionLabel } from "../../../api/app-version"
import { useInterfaceLanguage, useTexts } from "../../../i18n/language-store"
import { fillText } from "../../../utils/fill-text"

export function useVersionNote(): string {
	const template = useTexts().appUpdate.version
	const language = useInterfaceLanguage()
	return fillText(template, { version: appVersionLabel() }, language)
}
