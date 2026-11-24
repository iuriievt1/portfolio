import { HELD_FOR_REVIEW_CAUSE, type HeldForReviewCause } from "@ansora/contracts"
import {
	ARCHIVE_NOT_SENT_REASON,
	type ArchiveExchange,
	DIMSE_STATUS,
	PERMANENT_FAILURE_CAUSE,
	type PermanentFailureCause,
} from "@ansora/vulna-domain"
import type { DeliveryInstance } from "../types/delivery.types"

// CAP-023-R17, CAP-028-R15
function subjectOf(instance: DeliveryInstance): string {
	return `instance ${instance.sopInstanceUid} záznamu ${instance.acquisitionId}`
}

function statusTextOf(statusHex: string | undefined): string {
	return statusHex === undefined ? "bez odpovědi PACS" : `stav PACS ${statusHex}`
}

const DATA_KEPT_TEXT = "Data zůstávají na serveru a doručení se samo neopakuje."

const HELD_TEXT: Readonly<Record<HeldForReviewCause, (statusHex: string | undefined) => string>> = {
	[HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS]: (statusHex) => `PACS ji odmítl (${statusTextOf(statusHex)})`,
	[HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH]: () =>
		"uložené bajty neodpovídají otisku ze sestavení a do PACS neodešel žádný bajt",
	[HELD_FOR_REVIEW_CAUSE.STUDY_IDENTITY_CONFLICT]: () => "její studie patří v PACS jinému pacientovi",
}

// CAP-023-R09, CAP-023-S19, CAP-023-S20
export function heldForReviewMessageOf(
	instance: DeliveryInstance,
	cause: HeldForReviewCause,
	statusHex: string | undefined,
): string {
	return `Doručení ${subjectOf(instance)} do PACS je zadržené k posouzení: ${HELD_TEXT[cause](statusHex)}. ${DATA_KEPT_TEXT}`
}

const PERMANENT_TEXT: Readonly<Record<PermanentFailureCause, string>> = {
	[PERMANENT_FAILURE_CAUSE.ATTEMPTS_EXHAUSTED]: "PACS ji nepřijal ani po posledním povoleném pokusu",
	[PERMANENT_FAILURE_CAUSE.UNDOCUMENTED_STATUS]: "PACS odpověděl stavem, který jeho Conformance Statement nepopisuje",
}

// CAP-023-R10, CAP-023-R12, CAP-023-R17
export function permanentFailureMessageOf(
	instance: DeliveryInstance,
	cause: PermanentFailureCause,
	statusHex: string | undefined,
): string {
	return `Doručení ${subjectOf(instance)} do PACS trvale selhalo: ${PERMANENT_TEXT[cause]} (${statusTextOf(statusHex)}). ${DATA_KEPT_TEXT}`
}

// CAP-023-R12, CAP-023-S21
export function storedWithWarningMessageOf(instance: DeliveryInstance, statusHex: string | undefined): string {
	return `PACS uložil ${subjectOf(instance)} s varováním (${statusTextOf(statusHex)}). Instance je v PACS; zkontrolujte ji tam.`
}

// CAP-023-R26, CAP-023-S18
export function verificationRejectedMessageOf(
	instance: DeliveryInstance,
	rejections: number,
	statusHex: string | undefined,
): string {
	return (
		`Ověření doručení ${subjectOf(instance)} do PACS čeká na zásah správce: PACS ověřovací dotaz ` +
		`${rejections}× za sebou odmítl (${statusTextOf(statusHex)}). Instance se znovu neodešle a data zůstávají na serveru.`
	)
}

// integrace-dicom.md 8.1
const PAUSE_BY_STATUS: Readonly<Record<string, string>> = {
	[DIMSE_STATUS.PREPROCESSING_ERROR]: "PACS hlásí chybu předzpracování při ukládání",
	[DIMSE_STATUS.POSTPROCESSING_ERROR]: "PACS hlásí chybu následného zpracování při ukládání",
	[DIMSE_STATUS.UNKNOWN_PEER]: "PACS nezná AE Title nebo IP adresu serveru",
	[DIMSE_STATUS.PEER_NOT_AUTHORIZED]: "server nemá v PACS roli pro ukládání",
	[DIMSE_STATUS.SOP_CLASS_NOT_SUPPORTED]: "PACS nepodporuje třídu SOP objektu",
}

// CAP-023-R11, CAP-023-R16, CAP-023-R23
function pauseReasonOf(exchange: ArchiveExchange): string {
	if (exchange.statusHex !== undefined) {
		return `${PAUSE_BY_STATUS[exchange.statusHex] ?? "PACS hlásí chybu nastavení"} (stav ${exchange.statusHex})`
	}
	if (exchange.notSentReason === ARCHIVE_NOT_SENT_REASON.NO_ACCEPTED_TRANSFER_SYNTAX) {
		return "PACS nepřijal žádnou nabízenou transfer syntaxi"
	}
	return `PACS trvale odmítl asociaci (${exchange.classification.ruleId})`
}

// CAP-023-R11, CAP-023-R23, CAP-023-S05
export function targetPausedMessageOf(exchange: ArchiveExchange): string {
	return (
		`Doručování do PACS je pozastavené: ${pauseReasonOf(exchange)}. ` +
		"Záznamy čekají na serveru a odešlou se, až správce po opravě nastavení cíl obnoví."
	)
}

// CAP-023-R27, CAP-023-S22
export function targetUnavailabilityMessageOf(alertSeconds: number): string {
	return (
		`PACS je nedostupný déle než nastavenou dobu ${alertSeconds} s. ` +
		"Záznamy čekají na serveru a odešlou se, jakmile PACS znovu odpoví."
	)
}
