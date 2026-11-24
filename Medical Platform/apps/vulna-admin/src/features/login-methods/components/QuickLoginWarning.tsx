import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import cs from "@/i18n/cs.json"

// CAP-012-R26
export function QuickLoginWarning() {
	return <Notice tone={NOTICE_TONE.WARN}>{cs.loginMethods.onlyAccount}</Notice>
}
