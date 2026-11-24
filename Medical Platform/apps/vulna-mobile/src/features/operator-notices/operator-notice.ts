import { OPERATOR_NOTIFICATION_KIND } from "@ansora/contracts"
import type { AcquisitionDraftSummary } from "../../api/acquisitions"
import type { OperatorNotification } from "../../api/operator-notifications"
import type { Texts } from "../../i18n/texts"
import { countText, fillText, pluralText } from "../../utils/fill-text"
import { formatDate, formatDateTime } from "../../utils/format-date"
import { patientNumberOf } from "../patient/patient-identity"

export interface OperatorNotice {
	notificationId: string
	title: string
	body: string
	draft: AcquisitionDraftSummary | undefined
}

// CAP-015-R20, CAP-015-S23, E75
function discardedNoticeOf(notification: OperatorNotification, texts: Texts): OperatorNotice {
	const language = texts.language
	const count = notification.discarded_count ?? 0
	const discardedAt = notification.discarded_at ?? notification.created_at
	const body = fillText(
		pluralText(texts.operatorNotices.discarded.body, count, language),
		{ n: count, time: formatDateTime(new Date(discardedAt), language) },
		language,
	)
	return {
		notificationId: notification.notification_id,
		title: texts.operatorNotices.discarded.title,
		body,
		draft: undefined,
	}
}

// CAP-015-R18, CAP-015-S43, E57
function reminderNoticeOf(
	notification: OperatorNotification,
	drafts: readonly AcquisitionDraftSummary[],
	texts: Texts,
): OperatorNotice {
	const language = texts.language
	const reminder = texts.operatorNotices.reminder
	const draft = drafts.find((candidate) => candidate.acquisition_id === notification.acquisition_id)
	if (draft === undefined) {
		return {
			notificationId: notification.notification_id,
			title: reminder.titleUndated,
			body: reminder.bodyUnknown,
			draft,
		}
	}
	return {
		notificationId: notification.notification_id,
		title: fillText(reminder.title, { date: formatDate(new Date(draft.updated_at), language) }, language),
		body: fillText(
			reminder.body,
			{
				patient: patientNumberOf(draft.patient),
				files: countText(texts.files[draft.kind], draft.file_count, language),
			},
			language,
		),
		draft,
	}
}

// CAP-015-R20, CAP-015-R18, CAP-019-R27
export function operatorNoticeOf(
	notification: OperatorNotification,
	drafts: readonly AcquisitionDraftSummary[],
	texts: Texts,
): OperatorNotice {
	if (notification.kind === OPERATOR_NOTIFICATION_KIND.DRAFT_DISCARDED_BY_ADMINISTRATOR) {
		return discardedNoticeOf(notification, texts)
	}
	if (notification.kind === OPERATOR_NOTIFICATION_KIND.DRAFT_REMINDER) {
		return reminderNoticeOf(notification, drafts, texts)
	}
	return {
		notificationId: notification.notification_id,
		title: texts.operatorNotices.other.title,
		body: texts.operatorNotices.other.body,
		draft: undefined,
	}
}
