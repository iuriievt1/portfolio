import { ClockIcon } from "@phosphor-icons/react"
import { NOTICE_TONE, Notice } from "@/components/custom/notice"
import cs from "@/i18n/cs.json"
import { fillText, formatTime } from "@/lib/format"

const WARNING_LEAD_MILLISECONDS = 120_000

// CAP-004-R11
export function IdleWarning({ idleExpiresAt }: { idleExpiresAt: string | undefined }) {
	if (idleExpiresAt === undefined || new Date(idleExpiresAt).getTime() - Date.now() > WARNING_LEAD_MILLISECONDS) {
		return null
	}
	return (
		<div className="print:hidden">
			<Notice tone={NOTICE_TONE.WARN} icon={<ClockIcon className="size-4" />}>
				{fillText(cs.session.idleWarning, { time: formatTime(idleExpiresAt) })}
			</Notice>
		</div>
	)
}
