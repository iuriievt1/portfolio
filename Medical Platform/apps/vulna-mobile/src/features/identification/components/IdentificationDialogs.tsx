import { nfcReader } from "@ansora/core-mobile"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ConfirmDialog, type DialogAction } from "../../../ui/ConfirmDialog"
import { fillText } from "../../../utils/fill-text"
import { openNfcSettings } from "../../../utils/open-nfc-settings"
import { openSettings } from "../../../utils/open-settings"
import { remoteFailureTextOf } from "../../remote/remote-failure-text"
import { IDENTIFICATION_PHASE, type PatientIdentificationFlow } from "../hooks/use-patient-identification"
import { useRetryAllowed } from "../hooks/use-retry-allowed"
import { IDENTIFICATION_NOTICE, type IdentificationNotice } from "../patient-identifier"

interface Props {
	flow: PatientIdentificationFlow
}

interface NoticeText {
	heading: string
	body: string
}

// CAP-013-R06, CAP-013-R10, CAP-013-S04, CAP-013-S11, CAP-013-S13, E12, E13, E70, E72, E73
export function IdentificationDialogs({ flow }: Props) {
	const texts = useTexts()
	const { phase } = flow
	const rateLimit =
		phase.kind === IDENTIFICATION_PHASE.NOTICE && phase.notice.kind === IDENTIFICATION_NOTICE.RATE_LIMITED
			? phase.notice
			: undefined
	const canRetry = useRetryAllowed(rateLimit)
	if (phase.kind === IDENTIFICATION_PHASE.READING_TAG && nfcReader().readsWithoutPrompt) {
		return (
			<ConfirmDialog
				title={texts.identification.tag.heading}
				body={texts.identification.tag.body}
				secondary={{ label: texts.identification.cancel, onPress: flow.cancelReading }}
			/>
		)
	}
	if (phase.kind !== IDENTIFICATION_PHASE.NOTICE) {
		return null
	}
	const { heading, body } = noticeTextOf(phase.notice, texts)
	return (
		<ConfirmDialog
			title={heading}
			body={body}
			primary={primaryActionOf(phase.notice, flow, canRetry, texts)}
			secondary={{ label: texts.identification.back, onPress: flow.dismiss }}
		/>
	)
}

function noticeTextOf(notice: IdentificationNotice, texts: Texts): NoticeText {
	switch (notice.kind) {
		case IDENTIFICATION_NOTICE.NOT_FOUND:
			return texts.identification.notFound
		case IDENTIFICATION_NOTICE.CODE_NOT_SET:
			return texts.identification.codeNotSet
		case IDENTIFICATION_NOTICE.TAG_NOT_MAPPED:
			return texts.identification.tagNotMapped
		case IDENTIFICATION_NOTICE.TAG_UNREADABLE:
			return texts.identification.tagUnreadable
		case IDENTIFICATION_NOTICE.NFC_DISABLED:
			return texts.identification.nfcDisabled
		case IDENTIFICATION_NOTICE.CAMERA_DENIED:
			return texts.identification.cameraDenied
		case IDENTIFICATION_NOTICE.TOO_BROAD:
			return texts.identification.tooBroad
		case IDENTIFICATION_NOTICE.RATE_LIMITED:
			return {
				heading: texts.identification.rateLimited.heading,
				body: fillText(texts.identification.rateLimited.body, { n: notice.retryAfterSeconds ?? 0 }, texts.language),
			}
		case IDENTIFICATION_NOTICE.FAILED:
			return remoteFailureTextOf(notice.failure, texts.identification.failed, texts)
		default:
			return notice satisfies never
	}
}

function primaryActionOf(
	notice: IdentificationNotice,
	flow: PatientIdentificationFlow,
	canRetry: boolean,
	texts: Texts,
): DialogAction | undefined {
	switch (notice.kind) {
		case IDENTIFICATION_NOTICE.NOT_FOUND:
		case IDENTIFICATION_NOTICE.TAG_UNREADABLE:
		case IDENTIFICATION_NOTICE.FAILED:
			return { label: texts.remote.retry, onPress: flow.retry }
		case IDENTIFICATION_NOTICE.TAG_NOT_MAPPED:
			return flow.canScanCode ? { label: texts.identification.tagNotMapped.action, onPress: flow.scanCode } : undefined
		case IDENTIFICATION_NOTICE.NFC_DISABLED:
			return { label: texts.identification.nfcDisabled.action, onPress: openNfcSettings }
		case IDENTIFICATION_NOTICE.CAMERA_DENIED:
			return { label: texts.identification.cameraDenied.action, onPress: openSettings }
		case IDENTIFICATION_NOTICE.RATE_LIMITED:
			return { label: texts.remote.retry, onPress: flow.retry, disabled: !canRetry }
		case IDENTIFICATION_NOTICE.CODE_NOT_SET:
		case IDENTIFICATION_NOTICE.TOO_BROAD:
			return undefined
		default:
			return notice satisfies never
	}
}
